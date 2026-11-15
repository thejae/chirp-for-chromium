import React from 'react'

export function PrivacyPolicyPage() {
  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full bg-neutral-100 text-center p-8 pb-24 border-b border-neutral-200 shadow-sm">
        <h1 className="w-full text-4xl font-bold">Privacy Policy</h1>
      </div>
      <div className="w-full max-w-screen-sm overflow-hidden p-4 flex flex-col gap-3 mt-8">
        <section className="mb-6">
          <h2 className="text-2xl font-bold mb-2">1. Introduction</h2>
          <p>
            Please read this Privacy Policy to learn about how we handle and
            share your information while using the extension.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-bold mb-2">2. Information Sharing</h2>
          <p>
            We only share data with these third parties to the extent necessary
            for the functionality of our service and for the purposes stated in
            this privacy policy.
          </p>
          <ul className="list-disc">
            <li>
              <a
                href="https://cloud.google.com/"
                className="text-blue-600 hover:underline font-bold"
              >
                Google Cloud
              </a>
              : Necessary for the primary function of our extension to
              synthesize text for playback or download.
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-bold mb-2">3. Data Security</h2>
          <p>
            Your data is important to us and we have implemented measures to
            ensure its security. However, no method of data transmission or
            storage is 100% secure, and while we strive for maximum security, we
            cannot guarantee it.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-bold mb-2">
            4. Changes to Our Privacy Policy
          </h2>
          <p>
            We may update this privacy policy from time to time. We will notify
            you of any changes by posting the updated privacy policy on our
            website. It is advised that you review this privacy policy
            periodically for any changes.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-bold mb-2">5. Contact Us</h2>
          <p>
            If you have any questions about this privacy policy or our
            practices, please file a report on{' '}
            <a
              href="https://github.com/thejae/chirp-for-chromium/issues"
              className="text-blue-600 hover:underline font-bold"
            >
              our GitHub repository
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
