import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Dear Samantha',
  description: 'Privacy Policy for Dear Samantha',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#E8E8F0]">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">

        {/* Header */}
        <div className="mb-12">
          <p className="mb-2 text-sm font-medium text-[#7C3AED]">Dear Samantha</p>
          <h1 className="mb-3 text-3xl font-semibold tracking-tight" style={{ letterSpacing: '-0.03em' }}>
            Privacy Policy
          </h1>
          <p className="text-sm text-[#6B6B80]">Effective Date: April 2026</p>
        </div>

        {/* Intro */}
        <div className="mb-10 rounded-2xl bg-[#13131F] px-6 py-5 text-sm leading-relaxed text-[#A0A0B8]">
          Thank you for using Dear Samantha. We built this app to help you stay meaningfully connected
          with the people you care about. Protecting your privacy is fundamental to that mission — you&apos;re
          trusting us with personal details about your relationships, and we take that seriously.
          <br /><br />
          This Privacy Policy explains what information we collect, how we use it, and the choices you
          have. By using the app, you agree to the practices described here.
        </div>

        <div className="space-y-10">

          {/* Section 1 */}
          <section>
            <SectionHeading number="1" title="Information We Collect" />

            <SubHeading>1.1 Information You Provide</SubHeading>
            <p className="mb-4 text-sm leading-relaxed text-[#A0A0B8]">
              When you create an account and use the app, you provide:
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-[#A0A0B8]">
              <Item>
                <strong className="text-[#C8C8DC]">Account information:</strong> your name and email address,
                obtained via Google Sign-In (OAuth). We do not store your Google password.
              </Item>
              <Item>
                <strong className="text-[#C8C8DC]">People you add:</strong> names, relationships, phone numbers,
                email addresses, and any notes you choose to enter about people in your life. When adding a
                person, you may import their details directly from your device&apos;s contacts — we access contacts
                only in that moment and save only the details you choose to import. We do not upload or sync
                your full contacts list.
              </Item>
              <Item>
                <strong className="text-[#C8C8DC]">Events and dates:</strong> birthdays, anniversaries,
                milestones, and other significant dates you save.
              </Item>
              <Item>
                <strong className="text-[#C8C8DC]">Voice input:</strong> when you use voice to compose messages,
                your speech is transcribed to text on your device. We do not store raw audio recordings. The
                transcribed text is saved to help generate and personalise your messages.
              </Item>
              <Item>
                <strong className="text-[#C8C8DC]">Messages:</strong> drafts and sent messages generated through
                the app, including any edits you make to AI-generated suggestions.
              </Item>
            </ul>

            <SubHeading>1.2 Information Collected Automatically</SubHeading>
            <p className="mb-4 text-sm leading-relaxed text-[#A0A0B8]">
              When you use the app, we automatically collect:
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-[#A0A0B8]">
              <Item>Device token for push notifications, so we can send you reminders about upcoming dates.</Item>
              <Item>Basic usage data such as which features you use, to improve the app experience.</Item>
              <Item>Crash and error reports to help us fix bugs.</Item>
            </ul>

            <SubHeading>1.3 Information from Third Parties</SubHeading>
            <p className="text-sm leading-relaxed text-[#A0A0B8]">
              <strong className="text-[#C8C8DC]">Google OAuth:</strong> when you sign in with Google, we receive
              your name and email address from Google. We do not access your Google Contacts, Gmail, or any
              other Google data.
            </p>
          </section>

          <Divider />

          {/* Section 2 */}
          <section>
            <SectionHeading number="2" title="How We Use Your Information" />
            <p className="mb-4 text-sm leading-relaxed text-[#A0A0B8]">We use the information we collect to:</p>
            <ul className="space-y-3 text-sm leading-relaxed text-[#A0A0B8]">
              <Item>Provide the core service: reminding you of important dates and helping you send thoughtful messages.</Item>
              <Item>
                Generate personalised message suggestions using AI (powered by Anthropic&apos;s Claude API). Your
                message history and edits help us tailor suggestions to your tone and style over time.
              </Item>
              <Item>Send push notifications for upcoming events and reminders.</Item>
              <Item>Improve the app: understanding how features are used helps us build a better product.</Item>
              <Item>Communicate with you about updates, support, and important notices.</Item>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-[#A0A0B8]">
              The app is currently free to use. We may introduce optional paid features in the future — if we
              do, we will update this policy and notify you before any changes take effect.
            </p>
            <p className="mt-3 rounded-xl bg-[#13131F] px-4 py-3 text-sm font-medium text-[#C8C8DC]">
              We do not sell your personal information. We do not use your data to serve you third-party advertising.
            </p>
          </section>

          <Divider />

          {/* Section 3 */}
          <section>
            <SectionHeading number="3" title="AI and Message Generation" />
            <p className="mb-3 text-sm leading-relaxed text-[#A0A0B8]">
              Dear Samantha uses Anthropic&apos;s Claude API to generate message suggestions. When you request a
              message, relevant context (such as the person&apos;s name, your relationship, the occasion, and your
              previous edits) is sent to Anthropic&apos;s API to produce a draft.
            </p>
            <p className="mb-3 text-sm leading-relaxed text-[#A0A0B8]">
              Anthropic processes this data in accordance with their own privacy policy and data processing
              terms. We do not send sensitive personal details beyond what is necessary for message generation.
            </p>
            <p className="text-sm leading-relaxed text-[#A0A0B8]">
              Your edits to AI-generated messages are stored and used to improve personalisation over time —
              this is a core feature of the app. You can request deletion of this data at any time (see Section 7).
            </p>
          </section>

          <Divider />

          {/* Section 4 — Third Parties */}
          <section>
            <SectionHeading number="4" title="How We Share Your Information" />
            <p className="mb-4 text-sm leading-relaxed text-[#A0A0B8]">
              We share data only in the following limited circumstances:
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-[#A0A0B8]">
              <Item>
                <strong className="text-[#C8C8DC]">Service providers:</strong> we use third-party services to
                operate the app, including Supabase (database and authentication), Anthropic (AI message
                generation), Resend (email delivery), and Railway (backend hosting). These providers process
                data only as necessary to deliver their services.
              </Item>
              <Item>
                <strong className="text-[#C8C8DC]">Legal requirements:</strong> we may disclose information if
                required by law, regulation, or valid legal process.
              </Item>
              <Item>
                <strong className="text-[#C8C8DC]">Business transfers:</strong> if the company is acquired or
                merged, your data may transfer to the new owner, who will be bound by this policy.
              </Item>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-[#A0A0B8]">
              We do not sell, rent, or share your personal data with advertisers or data brokers.
            </p>
          </section>

          <Divider />

          {/* Section 5 */}
          <section>
            <SectionHeading number="5" title="Data Storage and Security" />
            <p className="mb-3 text-sm leading-relaxed text-[#A0A0B8]">
              Your data is stored on Supabase infrastructure hosted in the EU (eu-west-1 region). We use
              industry-standard security measures including encrypted connections (HTTPS/TLS) and access controls.
            </p>
            <p className="text-sm leading-relaxed text-[#A0A0B8]">
              No system is completely secure. While we work hard to protect your information, we cannot
              guarantee absolute security. If you believe your account has been compromised, please contact
              us immediately.
            </p>
          </section>

          <Divider />

          {/* Section 6 */}
          <section>
            <SectionHeading number="6" title="Children's Privacy" />
            <p className="text-sm leading-relaxed text-[#A0A0B8]">
              Dear Samantha is not directed at children under 13 (or under 16 in the EU/EEA). We do not
              knowingly collect personal information from children. If you believe a child has provided us
              with personal data, please contact us and we will delete it promptly.
            </p>
          </section>

          <Divider />

          {/* Section 7 */}
          <section>
            <SectionHeading number="7" title="Your Rights and Choices" />
            <p className="mb-4 text-sm leading-relaxed text-[#A0A0B8]">
              Depending on where you live, you may have the right to:
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-[#A0A0B8]">
              <Item>Access the personal data we hold about you.</Item>
              <Item>Correct inaccurate or incomplete data.</Item>
              <Item>Delete your account and all associated data.</Item>
              <Item>Export your data in a portable format.</Item>
              <Item>Opt out of push notifications (via your device settings).</Item>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-[#A0A0B8]">
              To exercise any of these rights, or to delete your account, contact us at the email below.
              We will respond within 30 days.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#A0A0B8]">
              <strong className="text-[#C8C8DC]">EU/EEA residents:</strong> you have additional rights under
              the GDPR, including the right to lodge a complaint with your local data protection authority.
            </p>
          </section>

          <Divider />

          {/* Section 8 */}
          <section>
            <SectionHeading number="8" title="Data Retention" />
            <p className="mb-3 text-sm leading-relaxed text-[#A0A0B8]">
              We retain your data for as long as your account is active. If you delete your account, we will
              delete your personal data within 30 days, except where we are required to retain it for legal
              or compliance purposes.
            </p>
            <p className="text-sm leading-relaxed text-[#A0A0B8]">
              Message personalisation data (your edits and tone preferences) is deleted along with your account.
            </p>
          </section>

          <Divider />

          {/* Section 9 */}
          <section>
            <SectionHeading number="9" title="Third-Party Services" />
            <p className="text-sm leading-relaxed text-[#A0A0B8]">
              The app uses deep links to open WhatsApp and iMessage with pre-filled messages. Once you leave
              the app, the privacy practices of those platforms apply. We do not send messages on your behalf
              through those platforms — the final send action is always yours.
            </p>
          </section>

          <Divider />

          {/* Section 10 */}
          <section>
            <SectionHeading number="10" title="Changes to This Policy" />
            <p className="text-sm leading-relaxed text-[#A0A0B8]">
              We may update this Privacy Policy from time to time. If we make material changes, we will notify
              you in the app or by email before the changes take effect. Your continued use of the app after
              the effective date constitutes acceptance of the updated policy.
            </p>
          </section>

          <Divider />

          {/* Section 11 — Contact */}
          <section>
            <SectionHeading number="11" title="Contact Us" />
            <p className="mb-4 text-sm leading-relaxed text-[#A0A0B8]">
              If you have questions, concerns, or requests regarding this Privacy Policy, please contact us:
            </p>
            <div className="rounded-2xl bg-[#13131F] px-6 py-5">
              <p className="text-sm text-[#6B6B80]">Email</p>
              <a
                href="mailto:privacy@dearsamantha.app"
                className="text-base font-medium text-[#7C3AED] hover:text-[#9B5EF5] transition-colors"
              >
                privacy@dearsamantha.app
              </a>
              <p className="mt-3 text-sm text-[#6B6B80]">
                We aim to respond to all privacy-related enquiries within 30 days.
              </p>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-[#1C1C2E] pt-8 text-center text-xs text-[#3D3D50]">
          © 2026 Dear Samantha. All rights reserved.
        </div>

      </div>
    </div>
  )
}

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <h2 className="mb-4 text-lg font-semibold tracking-tight text-[#E8E8F0]" style={{ letterSpacing: '-0.02em' }}>
      <span className="mr-2 text-[#7C3AED]">{number}.</span>
      {title}
    </h2>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 mt-6 text-sm font-semibold text-[#C8C8DC]">{children}</h3>
  )
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7C3AED]" />
      <span>{children}</span>
    </li>
  )
}

function Divider() {
  return <hr className="border-[#1C1C2E]" />
}
