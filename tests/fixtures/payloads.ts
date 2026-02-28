/**
 * Test fixtures — CRM webhook payloads shaped like real data.
 * Covers HubSpot, Salesforce, Attio, Pipedrive, Close, generic, and minimal.
 */

export const hubspotPayload = {
  properties: {
    dealname: "Acme Corp Enterprise Platform",
    dealstage: "Proposal Sent",
    industry: "Financial Services",
    competitor: "Gong",
    hs_competitor: "Gong",
    amount: 150000,
    company: "Acme Corp",
    hubspot_owner_email: "sarah.chen@yourcompany.com",
    rep_slack_id: "U04HUBSPOT1",
    notes: "CFO involved in decision. Budget approved for Q2.",
    product_interest: "Enterprise Platform + Analytics Add-on",
  },
};

export const salesforcePayload = {
  Name: "GlobalTech Series B Expansion",
  StageName: "Negotiation",
  Industry__c: "SaaS / Technology",
  Competitor__c: "Outreach",
  Amount: 85000,
  Account: { Name: "GlobalTech Inc" },
  Owner: { Email: "james.rivera@yourcompany.com" },
  Rep_Slack_ID__c: "U04SFDC1",
  Description: "VP of Sales is champion, CRO needs ROI proof.",
  Product_Interest__c: "Sales Engagement Suite",
};

export const attioPayload = {
  attributes: {
    name: "DataSync Pro Deal",
    stage: "Proposal Sent",
    industry: "Healthcare",
    competitor: "Salesloft",
    company: "DataSync Health",
    value: 120000,
    owner_email: "lisa@yourcompany.com",
    rep_slack_id: "U04ATTIO1",
    notes: "Need HIPAA compliance proof.",
    product_interest: "Pro Plan",
  },
};

export const pipedrivePayload = {
  current: {
    title: "MedFlow Enterprise",
    stage_name: "Negotiation",
    org_name: "MedFlow Inc",
    value: 95000,
    industry: "Healthcare",
    competitor: "HubSpot",
    owner_email: "mike@yourcompany.com",
    rep_slack_id: "U04PIPE1",
    notes: "Demo went well, CTO is champion.",
    product_interest: "Enterprise Suite",
  },
  previous: {
    stage_name: "Proposal Sent",
  },
};

export const closePayload = {
  lead: {
    display_name: "TechStart Seed Round",
    name: "TechStart Inc",
  },
  status_label: "Proposal Sent",
  value: 45000,
  industry: "SaaS / Technology",
  competitor: "Apollo",
  user_email: "rep@yourcompany.com",
  rep_slack_id: "",
  note: "Seed stage, budget constrained.",
  product_interest: "Starter Plan",
};

export const genericPayload = {
  deal_name: "QuickStart SMB Deal",
  deal_stage: "Proposal Sent",
  industry: "Healthcare",
  competitor: "Not specified",
  deal_size: 25000,
  company_name: "MedFlow Health",
  rep_email: "rep@yourcompany.com",
  rep_slack_id: "",
  deal_notes: "",
  product_interest: "Starter Plan",
};

export const minimalPayload = {
  deal_stage: "Proposal Sent",
};

// Webhook-wrapped payload (n8n style)
export const wrappedPayload = {
  body: hubspotPayload,
  headers: {},
  params: {},
  query: {},
};

// Outcome payloads
export const closedWonPayload = {
  deal_name: "Acme Corp Enterprise Platform",
  deal_stage: "Closed Won",
  company_name: "Acme Corp",
  industry: "Financial Services",
  deal_size: 150000,
};

export const closedLostPayload = {
  deal_name: "Beta Inc Expansion",
  deal_stage: "Closed Lost",
  company_name: "Beta Inc",
  industry: "Healthcare",
  deal_size: 80000,
};

// Feedback payloads

export const slackButtonPayload = {
  payload: JSON.stringify({
    actions: [
      {
        action_id: "feedback_helpful",
        value: "del-test123",
      },
    ],
    user: { id: "U12345" },
  }),
};

export const slackNotHelpfulPayload = {
  payload: JSON.stringify({
    actions: [
      {
        action_id: "feedback_not_helpful",
        value: "del-test456",
      },
    ],
    user: { id: "U67890" },
  }),
};

export const slackThreadReplyPayload = {
  event: {
    type: "message",
    thread_ts: "1234567890.123456",
    text: "Prospect asked about SOC 2 compliance — we don't have an answer for that.",
    user: "U12345",
  },
};

export const slackVerificationPayload = {
  type: "url_verification",
  challenge: "abc123challenge",
};

export const telegramCallbackPayload = {
  callback_query: {
    data: "helpful:del-tg789",
    from: { id: 987654321 },
  },
};

export const telegramReplyPayload = {
  message: {
    text: "Gong just launched real-time coaching too — our differentiator needs updating.",
    from: { id: 111222333 },
    reply_to_message: { message_id: 42 },
  },
};

export const callIntelPayload = {
  deal_name: "Acme Corp",
  summary:
    "The prospect asked about SOC 2 compliance — we don't have positioning for that.",
  source: "gong",
};
