import os
import re
import aiohttp
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")
API_BASE = os.getenv("GETDICED_API_BASE", "https://get-diced.com")

intents = discord.Intents.default()
intents.message_content = True  # enable in Dev Portal too (Privileged Intents)

bot = commands.Bot(command_prefix="!", intents=intents)

# Matches [anything not containing square brackets]
BRACKET_RE = re.compile(r"\[([^\[\]]+)\]")


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


async def fetch_card(session: aiohttp.ClientSession, slug: str):
    # Public API (nginx proxies /cards -> FastAPI)
    url = f"{API_BASE}/cards/slug/{slug}"
    try:
        async with session.get(url, timeout=6) as resp:
            if resp.status == 200:
                return await resp.json()
    except Exception:
        pass
    return None


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user} ({bot.user.id})")
    # sync slash commands once at startup
    try:
        synced = await bot.tree.sync()
        print(f"Synced {len(synced)} command(s)")
    except Exception as e:
        print(f"Slash sync failed: {e}")


@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return

    matches = BRACKET_RE.findall(message.content)
    if not matches:
        return

    # keep it sane: unique, max 5 per message
    seen = set()
    names = []
    for m in matches:
        nm = m.strip()
        key = nm.lower()
        if nm and key not in seen:
            seen.add(key)
            names.append(nm)
            if len(names) >= 5:
                break

    embeds, links = [], []
    async with aiohttp.ClientSession() as session:
        for name in names:
            slug = slugify(name)
            data = await fetch_card(session, slug)
            url = f"{API_BASE}/card/{slug}"

            if data:
                # build a compact embed (Discord will also auto-unfurl links if posted)
                title = data.get("name") or name
                rules = (data.get("rules_text") or "").strip()
                desc = ""
                if rules:
                    m = re.match(r".+?(?:[.!?](?=\s|$)|$)", rules)
                    desc = m.group(0) if m else rules

                embed = discord.Embed(title=title, url=url, description=desc)
                uuid = data.get("db_uuid")
                if uuid:
                    img = f"{API_BASE}/images/fullsize/{uuid[:2]}/{uuid}.webp"
                    embed.set_thumbnail(url=img)
                embeds.append(embed)
            else:
                # fallback link if card not found via API
                links.append(f"{name} → {url}")

    if embeds or links:
        try:
            await message.reply(
                content="\n".join(links) if links else None,
                embeds=embeds,
                mention_author=False,
            )
        except discord.HTTPException:
            await message.channel.send(
                content="\n".join(links) if links else None,
                embeds=embeds,
            )

    # keep command processing working
    await bot.process_commands(message)


# Optional: /card slash command works without Message Content intent
@bot.tree.command(name="card", description="Link a Supershow card by name")
async def slash_card(interaction: discord.Interaction, name: str):
    await interaction.response.defer(thinking=False, ephemeral=True)
    slug = slugify(name)
    url = f"{API_BASE}/card/{slug}"
    async with aiohttp.ClientSession() as session:
        data = await fetch_card(session, slug)
    if not data:
        await interaction.followup.send(f"Not found: {name}")
        return

    title = data.get("name") or name
    rules = (data.get("rules_text") or "").strip()
    desc = ""
    if rules:
        m = re.match(r".+?(?:[.!?](?=\s|$)|$)", rules)
        desc = m.group(0) if m else rules

    embed = discord.Embed(title=title, url=url, description=desc)
    uuid = data.get("db_uuid")
    if uuid:
        embed.set_thumbnail(url=f"{API_BASE}/images/fullsize/{uuid[:2]}/{uuid}.webp")
    await interaction.followup.send(embed=embed)


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("Missing DISCORD_TOKEN in .env")
    bot.run(TOKEN)
