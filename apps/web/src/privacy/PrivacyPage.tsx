// Plain on purpose: this page is about its words. Anything in [brackets] is not decided yet.
export function PrivacyPage() {
  return (
    <main className="plain">
      <p>
        <a href="/">Back to Ink</a>
      </p>

      <h1>Privacy</h1>
      <p>Draft · last updated 29 September 2026</p>

      <p>
        Ink is a private place for your writing. This page says, in plain words, what Ink keeps, why, and who else is
        involved. If anything here changes, this page changes first.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>Your writing is yours. Only you can read it.</li>
        <li>Ink keeps only what it needs to sign you in and keep your writing safe.</li>
        <li>No ads, no tracking, no selling or sharing your data.</li>
        <li>Nothing you write is used to train anyone's models.</li>
      </ul>

      <h2>What Ink keeps</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address. If you sign in with Google, Google also shares your name
          and profile picture with Ink; Ink does not use them for anything yet.
        </li>
        <li>
          <strong>Your settings, only if you choose them:</strong> a pen name, and which seasons Ink groups your writing
          by. Ink never stores your time zone or location; it reads the time zone on your device only.
        </li>
        <li>
          <strong>Your writing:</strong> each piece you write, its title if you give one, its language, and when you
          created and last changed it.
        </li>
        <li>
          <strong>Your pictures, only if you add them:</strong> a cover or a picture in your notes. Before a picture
          leaves your device, Ink makes it smaller and keeps only the image itself, so the place, camera and time a
          photo was taken are never sent. A picture you take off a piece stays in your Pictures until you delete it
          there; deleting it removes it for good.
        </li>
        <li>
          <strong>A password, only if you add one:</strong> it is stored scrambled (hashed), never as you typed it.
        </li>
        <li>
          <strong>Sign-in records:</strong> the services below keep short technical logs (such as the time of a
          sign-in and the network address it came from) to keep accounts secure.
        </li>
      </ul>

      <h2>What Ink does not do</h2>
      <ul>
        <li>No advertising, no analytics, no tracking cookies.</li>
        <li>No selling, renting or sharing your data with anyone for their own use.</li>
        <li>No reading your writing to show you ads or to train models.</li>
      </ul>

      <h2>On your device</h2>
      <p>
        Your browser keeps a sign-in token so you stay signed in. It is removed when you sign out. Ink sets no
        cookies.
      </p>
      <p>
        So that nothing you write is lost, each change is first kept in your browser&rsquo;s own storage on this device,
        then sent to Ink. Once Ink has it, the copy on the device is removed. If you are offline or sign out before it
        is sent, it waits there and is sent the next time you sign in on this device. Your Light or Dark choice and
        whether the menu is open are remembered there too. Nothing else is stored on your device.
      </p>

      <h2>Who is involved</h2>
      <p>Ink uses a few services to run. Each one handles your data only to do its job for Ink.</p>
      <ul>
        <li>
          <strong>Supabase</strong> stores your account, your writing and your pictures, in a data centre in Mumbai,
          India.
        </li>
        <li>
          <strong>Google</strong>, only if you choose Continue with Google, to confirm who you are. Ink&rsquo;s fonts are
          served by Ink itself, not by Google or anyone else.
        </li>
        <li>
          <strong>An email service</strong> sends your 6-digit sign-in codes. [Which one, once Ink has its own
          domain.]
        </li>
        <li>
          <strong>Hosting</strong> for the app and its server. [Names and regions, once Ink is deployed.]
        </li>
      </ul>

      <h2>Who can read your writing</h2>
      <p>
        Only you, through Ink. Every request for your writing or your pictures is checked against your account, so another writer
        cannot open it even by guessing a link. [Who at Ink can technically reach the database, and the promise about
        when they would, if ever.]
      </p>

      <h2>Features that look at your writing</h2>
      <p>
        Ink is built to notice when an older piece is close to a new one. Those features are not switched on yet. Before
        they are, this page will say exactly how they work: what is analysed, where, and whether any of it leaves Ink's
        own servers. [To be decided.]
      </p>

      <h2>Keeping and deleting</h2>
      <p>
        Your writing stays until you delete it. [How to delete a piece or your whole account, and how long deleted
        writing and backups are kept.]
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can ask for a copy of everything Ink keeps about you.</li>
        <li>You can ask Ink to correct or delete it.</li>
        <li>To do either, write to [contact email].</li>
      </ul>

      <h2>Who runs Ink</h2>
      <p>[Name of the person or company responsible for Ink, and where it is based.]</p>

      <h2>Children</h2>
      <p>[Minimum age to use Ink.]</p>

      <h2>Changes</h2>
      <p>
        When this page changes in a way that matters, Ink will tell you before the change takes effect. The date at the
        top always shows the latest version.
      </p>
    </main>
  );
}
