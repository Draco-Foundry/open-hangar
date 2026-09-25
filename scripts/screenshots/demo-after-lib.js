// Loaded after lib.js: swap the live RSI account/referral calls for demo data.
OH.getAccount = async () => ({ ...window.DEMO_ACCOUNT, fetchedAt: Date.now() });
OH.getReferral = async () => ({ referral: window.DEMO_REFERRAL });
