export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-6">Privacy Policy</h1>
      <p className="text-gray-400 text-sm mb-8">Last updated: November 20, 2025</p>

      <div className="space-y-6 text-gray-300">
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Overview</h2>
          <p>
            This privacy policy applies to the SRG Collection Manager mobile app ("App") and the
            get-diced.com website ("Website"). We are committed to protecting your privacy and
            being transparent about our data practices.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Information We Collect</h2>

          <h3 className="text-lg font-medium text-white mt-4 mb-2">Mobile App</h3>
          <p>The SRG Collection Manager app:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
            <li>Does NOT collect any personal information</li>
            <li>Does NOT require account creation or login</li>
            <li>Does NOT track your location</li>
            <li>Does NOT use analytics or tracking services</li>
            <li>Stores all your collection and deck data locally on your device only</li>
          </ul>

          <h3 className="text-lg font-medium text-white mt-4 mb-2">Website</h3>
          <p>The get-diced.com website:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
            <li>Does NOT require account creation</li>
            <li>Does NOT use cookies for tracking</li>
            <li>May collect anonymous server logs (IP addresses, browser type) for security purposes</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Data Storage</h2>
          <p>
            All card collection and deck data in the mobile app is stored locally on your device.
            We do not have access to your collection data. If you uninstall the app, your data
            will be deleted.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Shared Lists</h2>
          <p>
            When you share a deck list using the "Share" feature, the deck data is uploaded to
            our server and assigned a unique URL. This shared data contains only card names and
            quantities - no personal information. Shared lists may be accessed by anyone with
            the link.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Third-Party Services</h2>
          <p>
            The app downloads card data and images from get-diced.com servers. No personal
            information is transmitted during these downloads.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Children's Privacy</h2>
          <p>
            Our services do not collect personal information from anyone, including children
            under 13 years of age.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you of any
            changes by posting the new policy on this page and updating the "Last updated" date.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
          <p>
            If you have questions about this privacy policy, please open an issue on our{" "}
            <a
              href="https://github.com/szarta/srg_card_search_website"
              className="text-srgPurple hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              GitHub repository
            </a>.
          </p>
        </section>

        <section className="border-t border-gray-700 pt-6 mt-8">
          <p className="text-sm text-gray-500">
            SRG Collection Manager is an unofficial fan project. All SRG Supershow card
            properties are copyright SRG Universe. This project is in no way supported or
            explicitly endorsed by the game or its creators.
          </p>
        </section>
      </div>
    </div>
  );
}
