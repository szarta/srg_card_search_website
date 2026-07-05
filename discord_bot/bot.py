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

STAT_KEYS = ["power", "technique", "agility", "strike", "submission", "grapple"]
COMPETITOR_TYPES = (
    "SingleCompetitorCard",
    "TornadoCompetitorCard",
    "TrioCompetitorCard",
)


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


def _extract_card_names(matches, limit=5):
    """Unique, original-cased bracket names, capped at `limit` per message."""
    seen = set()
    names = []
    for m in matches:
        nm = m.strip()
        key = nm.lower()
        if nm and key not in seen:
            seen.add(key)
            names.append(nm)
            if len(names) >= limit:
                break
    return names


def _build_stat_line(data):
    """Compact stats line, e.g. "Power 8 • Technique 6", for competitor/main-deck cards."""
    stat_parts = []
    if data.get("card_type") in COMPETITOR_TYPES:
        for k in STAT_KEYS:
            v = data.get(k)
            if v is not None:
                stat_parts.append(f"{k.capitalize()} {v}")

    if (
        data.get("card_type") == "MainDeckCard"
        and data.get("deck_card_number") is not None
    ):
        stat_parts.append(f"Deck #{data.get('deck_card_number')}")

    return " • ".join(stat_parts)


def _build_card_embed(data, name, url):
    """Build a discord.Embed from a resolved card payload."""
    title = data.get("name") or name
    rule_snip = (data.get("rules_text") or "").strip()
    stat_line = _build_stat_line(data)

    # description: stats (if any) + blank line + rules snippet
    desc_chunks = [chunk for chunk in (stat_line, rule_snip) if chunk]
    desc = "\n\n".join(desc_chunks) if desc_chunks else None

    embed = discord.Embed(title=title, url=url, description=desc)
    uuid = data.get("db_uuid")
    if uuid:
        img = f"{API_BASE}/images/fullsize/{uuid[:2]}/{uuid}.webp"
        embed.set_thumbnail(url=img)
    return embed


async def _resolve_cards(session, names):
    """Resolve card names into (embeds, fallback links)."""
    embeds, links = [], []
    for name in names:
        slug = slugify(name)
        url = f"{API_BASE}/card/{slug}"
        data = await fetch_card(session, slug)
        if data:
            embeds.append(_build_card_embed(data, name, url))
        else:
            # fallback link if card not found via API
            links.append(f"{name} → {url}")
    return embeds, links


@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return

    matches = BRACKET_RE.findall(message.content)
    if not matches:
        return

    # keep it sane: unique, max 5 per message
    names = _extract_card_names(matches)

    async with aiohttp.ClientSession() as session:
        embeds, links = await _resolve_cards(session, names)

    if embeds or links:
        content = "\n".join(links) if links else None
        try:
            await message.reply(
                content=content,
                embeds=embeds,
                mention_author=False,
            )
        except discord.HTTPException:
            await message.channel.send(
                content=content,
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
    rule_snip = rules

    stats_keys = ["power", "technique", "agility", "strike", "submission", "grapple"]
    stat_parts = []
    if data.get("card_type") in (
        "SingleCompetitorCard",
        "TornadoCompetitorCard",
        "TrioCompetitorCard",
    ):
        for k in stats_keys:
            v = data.get(k)
            if v is not None:
                stat_parts.append(f"{k.capitalize()} {v}")
    if (
        data.get("card_type") == "MainDeckCard"
        and data.get("deck_card_number") is not None
    ):
        stat_parts.append(f"Deck #{data.get('deck_card_number')}")
    stat_line = " • ".join(stat_parts)

    desc_chunks = []
    if stat_line:
        desc_chunks.append(stat_line)
    if rule_snip:
        desc_chunks.append(rule_snip)
    desc = "\n\n".join(desc_chunks) if desc_chunks else None

    embed = discord.Embed(title=title, url=url, description=desc)
    uuid = data.get("db_uuid")
    if uuid:
        embed.set_thumbnail(url=f"{API_BASE}/images/fullsize/{uuid[:2]}/{uuid}.webp")
    await interaction.followup.send(embed=embed)


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("Missing DISCORD_TOKEN in .env")
    bot.run(TOKEN)
