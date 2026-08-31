export const ADMIN_ANALYTICS_DAYS = [7, 30, 90, 365] as const;
export type AdminAnalyticsDays = (typeof ADMIN_ANALYTICS_DAYS)[number];

export type AdminDayBucket = {
  date: string;
  signups: number;
  logins: number;
  tutorialsCreated: number;
  tutorialsPublished: number;
  stripeStarted: number;
  stripeReady: number;
  purchases: number;
  gmvCents: number;
};

export type AdminAnalytics = {
  days: number;
  generatedAt: string;
  live: {
    tutorials: {
      total: number;
      draft: number;
      published: number;
      paidPublished: number;
      creators: number;
      plays: number;
    };
    stripe: { accounts: number; payoutsEnabled: number };
    commerce: {
      purchases: number;
      welcomeClaims: number;
      gmvCents: number;
      platformFeeCents: number;
      refunds: number;
      payoutsPaidCents: number;
      payoutsCount: number;
    };
  };
  range: {
    signups: number;
    signupsNewAccount: number;
    signupsExistingAccount: number;
    logins: number;
    uniqueLogins: number;
    stripeStarted: number;
    stripeReady: number;
    tutorialsCreated: number;
    tutorialsPublished: number;
    tutorialsForked: number;
    purchases: number;
    welcomeClaims: number;
    gmvCents: number;
    platformFeeCents: number;
    payouts: number;
    premiumActivated: number;
    referrals: number;
  };
  funnel: { label: string; count: number }[];
  series: AdminDayBucket[];
  topTutorials: {
    id: string;
    title: string;
    playCount: number;
    ratingAvg: number;
    ratingCount: number;
    isPaid: boolean;
    status: string;
  }[];
  topSellers: { tutorialId: string; title: string; sales: number; gmvCents: number }[];
  categories: { name: string; count: number }[];
  recent: {
    id: string;
    eventName: string;
    userId: string | null;
    createdAt: string;
    eventData: Record<string, unknown>;
  }[];
};
