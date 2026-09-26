// Help & FAQ content, as approved on the design canvas. Every answer describes
// what the app actually does; if a rule changes (limits, K-factor, 30 days),
// update the answer here too.

export interface FaqItem {
  id: string;
  q: string;
  a: string;
  /** Small highlighted facts shown under the answer. */
  facts?: { title: string; text: string }[];
  link?: { href: string; label: string };
}

export interface FaqSection {
  id: string;
  title: string;
  items: FaqItem[];
}

export const FAQ: FaqSection[] = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      { id: "what-is", q: "What is Pickle Rating?", a: "An independent ranking for pickleball players in the Philippines. Ratings come only from matches played and confirmed here. No DUPR or other outside rating is needed." },
      { id: "join", q: "How do I join?", a: "Tap Join and enter your name, region, city, email and a password, then confirm your email. You start at 1500 in both singles and doubles.", link: { href: "/signup", label: "Create your profile" } },
      { id: "free", q: "Is it free?", a: "Yes. Creating a profile, recording matches, joining clubs and entering tournaments are all free." },
    ],
  },
  {
    id: "ratings",
    title: "Ratings",
    items: [
      {
        id: "calculated",
        q: "How is my rating calculated?",
        a: "Pickle Rating uses Elo, the same idea chess uses. Everyone starts at 1500. Before each match we work out each side's chance of winning from their ratings. Beat someone stronger and you gain a lot; lose to someone weaker and you drop more. Only confirmed matches count, and nobody can change a rating by hand, not even admins.",
        facts: [
          { title: "Separate", text: "Singles and doubles have their own ratings." },
          { title: "Team average", text: "In doubles, your team is rated as the average of you and your partner." },
          { title: "32 → 16", text: "Your first 20 rated matches move you faster, so you find your level sooner." },
        ],
      },
      { id: "points", q: "Why did I gain (or lose) that many points?", a: "It depends on how likely you were to win. An upset moves ratings more than an expected result. New players also move faster: for your first 20 rated matches in a format each result counts double (up to 32 points), then up to 16, so your rating settles near your real level quickly." },
      { id: "provisional", q: "What does the “P” next to a rating mean?", a: "Provisional: fewer than 5 rated matches in that format. You're ranked like everyone else, but your rating is still settling. The P disappears after your 5th confirmed match." },
      { id: "appear", q: "Where do I appear in the rankings?", a: "You appear once you have at least one confirmed match in that format. Rankings can be viewed for the whole Philippines, for your region, or for your city.", link: { href: "/", label: "See the rankings" } },
      { id: "dupr", q: "Is this connected to DUPR?", a: "No. Pickle Rating is fully independent. Our ratings use a different scale (starting at 1500) and are not shared with or taken from DUPR." },
    ],
  },
  {
    id: "matches",
    title: "Recording matches",
    items: [
      { id: "record", q: "How do I record a match?", a: "Tap the orange + button, choose singles or doubles, add your partner and opponents (search by name or scan their check-in QR), enter the game scores with your team first, and save. You can record matches up to 30 days after playing them.", link: { href: "/matches/new", label: "Record a match" } },
      { id: "not-counted", q: "Why hasn't my match counted yet?", a: "A match only counts once someone on the other team confirms the score. Until then it shows as “Waiting for confirmation” and ratings don't move. Send your opponent the match page, or let them scan its QR code at the court.", link: { href: "/matches", label: "See your matches" } },
      { id: "wrong-score", q: "The score is wrong. What can I do?", a: "If someone recorded a wrong score against you, open the match and tap Dispute; an admin will review it and it won't count in the meantime. If you recorded it yourself and it's still waiting, you can cancel it and record it again." },
      { id: "qr", q: "How does QR check-in work?", a: "Your profile has a check-in QR code. At the court, your opponent scans it with their phone camera to add you to the match they're recording. Each waiting match also has a QR code the other team can scan to open it and confirm." },
      { id: "all-count", q: "Do all matches count toward ratings?", a: "Every confirmed match counts. If you don't want a friendly game to count, simply don't record it." },
    ],
  },
  {
    id: "clubs",
    title: "Clubs",
    items: [
      { id: "club-ratings", q: "What are club ratings?", a: "Each club keeps its own ranking, calculated only from matches played inside that club. A club match counts twice: once for your national rating and once for your club rating." },
      { id: "start-club", q: "How do I start or join a club?", a: "Open Clubs. Anyone signed in can start a club (up to 5) and becomes its owner; anyone can join a club from its page. To record a club match, every player must be a member.", link: { href: "/clubs", label: "Browse clubs" } },
    ],
  },
  {
    id: "tournaments",
    title: "Tournaments",
    items: [
      { id: "brackets", q: "How do brackets work?", a: "Tournaments are single elimination. When the organizer closes registration, entries are seeded by rating (a doubles pair by its average), and the top seeds get byes if the numbers are uneven. Seed 1 and seed 2 can only meet in the final." },
      { id: "tournament-count", q: "Do tournament matches count?", a: "Yes. The organizer enters each result as the referee, so it counts immediately, and the winner moves on to the next round automatically." },
      { id: "enter", q: "How do I enter a tournament?", a: "Open it from Tournaments and tap Register while registration is open. For doubles, choose your partner. Club tournaments are for that club's members only.", link: { href: "/tournaments", label: "See tournaments" } },
    ],
  },
  {
    id: "account",
    title: "Your account",
    items: [
      { id: "forgot", q: "I forgot my password.", a: "On the sign-in page tap “Forgot password?”, enter your email, and follow the link we send you to choose a new one.", link: { href: "/forgot-password", label: "Reset your password" } },
      { id: "edit", q: "How do I change my name, region or city?", a: "Open your profile and tap Edit profile.", link: { href: "/profile", label: "Edit profile" } },
      { id: "contact", q: "How do I contact the team?", a: "Use Send feedback at the bottom of any page. Choose whether it's a suggestion, a problem with the app or a score issue; the team reads every message.", link: { href: "/feedback", label: "Send feedback" } },
    ],
  },
];
