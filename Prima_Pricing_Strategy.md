# Prima — Pricing Strategy & Token Economics

## 1. THE HARD TRUTH ABOUT YOUR CURRENT PRICING

You proposed: **PKR 20,000 setup + PKR 2,000–3,000/month (with AI)**.

Before recommending anything, here is what the AI actually costs based on current LLM API rates (May 2026):

### Real LLM Token Costs (per million tokens, USD)

| Model | Input | Output | Best For |
|---|---|---|---|
| Gemini 1.5 Flash | $0.075 | $0.30 | Cheapest, basic tasks |
| GPT-4o-mini | $0.15 | $0.60 | Cheap classification |
| **Claude Haiku 4.5** | **$1.00** | **$5.00** | **Recommended baseline** |
| GPT-4o | $2.50 | $10.00 | Mid-tier |
| **Claude Sonnet 4.6** | **$3.00** | **$15.00** | **Recommended premium** |
| Claude Opus 4.7 | $5.00 | $25.00 | Heaviest reasoning |

At PKR/USD ≈ 280, Claude Haiku costs PKR 280/M input tokens and PKR 1,400/M output tokens.

### Estimated Monthly AI Cost Per Organization (Realistic Workload)

For a typical distribution business (50 SKUs, 100 clients, 5 sales reps, daily DSRs):

| Feature | Tokens/month | Model | Cost (USD) | Cost (PKR) |
|---|---|---|---|---|
| Inventory predictions (with explanations) | 750K | Haiku | $0.75 | 210 |
| Dormant client detection | 150K | Haiku | $0.15 | 42 |
| Anomaly detection | 150K | Haiku | $0.15 | 42 |
| Report summaries | 100K | Haiku | $0.10 | 28 |
| **AI Chat (light admin: 5 queries/day)** | 750K | Sonnet | $2.25 | 630 |
| **AI Chat (heavy admin: 50 queries/day)** | 7.5M | Sonnet | $22.50 | 6,300 |
| Embeddings (one-time + updates) | 500K | Haiku embed | $0.05 | 14 |

**Realistic monthly AI cost per tenant:**
- Light user: **~PKR 950** (room for margin at PKR 3,000)
- Medium user: **~PKR 2,800** (break-even at PKR 3,000)
- Heavy user: **~PKR 7,000+** (LOSS at PKR 3,000)

**Verdict:** PKR 2,000–3,000/month flat-rate with unlimited AI is a money-losing model the moment you onboard one heavy user. You will subsidize heavy users with light-user profits, but that math breaks at scale.

---

## 2. ANSWER TO YOUR QUESTION: PAY-AS-YOU-GO?

You asked: *"Can we add tokens to each user and user pay as they go?"*

**My honest opinion: Pure pay-as-you-go is suboptimal. Hybrid is better.**

### Why Pure PAYG Hurts You

1. **Friction kills usage.** Every AI button click feels like spending money. Users will avoid the feature, reducing the value they perceive, and you lose the "AI-powered" differentiation you are paying to build.
2. **Unpredictable revenue.** Investors and your own cash flow planning suffer without recurring subscription baseline.
3. **Onboarding objection.** "How much will I pay?" becomes the first question, not "what does this do for me?"
4. **Top-up fatigue.** Every refill is a chance for the customer to reconsider whether they still need the product.

### Why Hybrid (Subscription + Top-Up Wallet) Wins

1. **Predictable base revenue** from monthly subscriptions.
2. **AI feels included** within the allowance, so users actually use it and become dependent.
3. **Heavy users pay more** via top-ups, protecting your margins.
4. **Industry standard.** This is how Twilio, OpenAI ChatGPT, Cursor, and every successful AI SaaS prices today.

---

## 3. RECOMMENDED PRICING STRUCTURE

### Setup Fee: PKR 20,000 (one-time, as you specified)

Justified because Prima requires: data migration help, branding setup, initial training, custom invoice template configuration, and dedicated onboarding support. This is your hedge against churn — once a tenant pays setup, they are committed.

### Monthly Subscription Tiers

| Plan | Price/month | Users | AI Tokens Included | Best For |
|---|---|---|---|---|
| **Starter** | **PKR 2,500** | Up to 5 | None (AI off) | Solo distributors / small shops |
| **Pro** | **PKR 6,000** | Up to 15 | 200,000/month (Haiku) | Growing businesses, basic AI |
| **Business** | **PKR 12,000** | Up to 50 | 1,000,000/month (mix) | Mid-size distribution networks |
| **Enterprise** | **Custom** | Unlimited | Custom | Large operations, multi-region |

**Why these numbers work:**

- **Starter at PKR 2,500** ≈ $9 USD. No AI = no variable cost. Pure margin after infrastructure (~$2/mo per tenant on Vercel + Supabase shared tier). Margin ~78%.
- **Pro at PKR 6,000** ≈ $21 USD. 200K Haiku tokens cost you ~$1.20. Plus infra ~$3. Total cost ~$4.20. Margin ~80%.
- **Business at PKR 12,000** ≈ $43 USD. 1M tokens (mix Haiku/Sonnet) cost you ~$8. Plus infra ~$5. Total cost ~$13. Margin ~70%.

### Token Top-Up Packs (When Plan Allowance Runs Out)

Available for Pro and Business tiers. Tokens never expire.

| Pack | Tokens | Price (PKR) | Per 1K tokens | Effective Markup |
|---|---|---|---|---|
| Mini | 50,000 | 400 | 8.00 | ~28x cost |
| Standard | 200,000 | 1,200 | 6.00 | ~21x cost |
| Plus | 1,000,000 | 4,500 | 4.50 | ~16x cost |
| Bulk | 5,000,000 | 18,000 | 3.60 | ~13x cost |

**Cost basis check:** Haiku at $1/M input ≈ PKR 0.28/1K tokens. Selling at PKR 3.60–8.00/1K = 13x–28x markup. This margin covers:
- Higher costs when Sonnet/Opus is used (5x and 25x Haiku)
- Output tokens (5x more expensive than input)
- Payment processing fees
- Support overhead
- Profit

### Auto-Top-Up (Optional, Recommended Default ON)

When a tenant hits 90% of their monthly allowance, automatically charge their card for the **Standard pack (200K tokens for PKR 1,200)**. Tenant configures threshold and pack size. This prevents service interruption and creates predictable upsell revenue.

---

## 4. PER-USER TOKEN ALLOCATION (YOUR IDEA, IMPROVED)

You asked about allocating tokens per user. Good idea, but implement it as **optional advanced control**, not the default. Two modes:

### Mode A — Organization Pool (Default)
All users in the organization share one token bucket. Simple. Most tenants will prefer this.

### Mode B — Per-User Allocation (Advanced)
Tenant Admin can set monthly quotas per user. Examples:
- Tenant Admin: unlimited (draws from org pool)
- Manager: 50,000 tokens/month
- Sales Rep: 10,000 tokens/month
- Viewer: 0 (no AI access)

When a user exhausts their personal quota, they see a friendly message and can request more from their admin.

**Why offer both:** Pool mode is easier to sell. Per-user mode is the upsell hook for Business+ tier ("manage AI costs by role").

---

## 5. SUPER ADMIN PLATFORM REVENUE MODEL

What you, as the Platform Owner, earn per tenant per month:

### Revenue Per Tenant (Annual)

| Plan | Setup (one-time) | Year 1 Revenue | Year 2+ Revenue |
|---|---|---|---|
| Starter | PKR 20,000 | PKR 50,000 | PKR 30,000 |
| Pro | PKR 20,000 | PKR 92,000 | PKR 72,000 |
| Business | PKR 20,000 | PKR 164,000 | PKR 144,000 |

### Break-Even Math

- Your infrastructure for 100 tenants: ~PKR 50,000/month (Vercel Pro, Supabase Pro, Upstash, Resend, Sentry, R2 storage)
- Your time + 1 support person: PKR 200,000/month
- **Total monthly burn:** PKR 250,000

**Break-even tenant counts:**
- 100 Starter tenants → PKR 250,000/month revenue → break-even
- 50 Pro tenants → PKR 300,000/month revenue → comfortably profitable
- 25 Business tenants → PKR 300,000/month revenue → very profitable

Target mix at month 12: 30 Starter + 30 Pro + 10 Business = ~PKR 375,000/month recurring + setup fees from new signups.

---

## 6. WHAT TO BUILD IN THE APP (BILLING MODULE)

Add this to the master prompt under Section 14 (Super Admin Platform):

### Subscription States
`TRIAL → ACTIVE → PAST_DUE → SUSPENDED → CANCELLED`

### Required Features

1. **Subscription Manager**
   - Super Admin can change a tenant's plan
   - Tenant Admin can upgrade/downgrade themselves (with confirmation)
   - Pro-rated billing on mid-cycle changes

2. **Token Wallet (per organization)**
   - Current balance display
   - Usage history graph (last 30/90/365 days)
   - Top-up packs purchasable in-app
   - Auto-top-up toggle and threshold setting

3. **Token Usage Dashboard**
   - Tokens used today / this month
   - Breakdown by feature (chat, prediction, alerts, etc.)
   - Breakdown by user (if Mode B enabled)
   - Estimated days remaining at current burn rate

4. **Per-User Quotas (Business+ tier only)**
   - Tenant Admin assigns monthly token limits per user or role
   - Soft warnings at 80%, hard block at 100%
   - User can request quota increase from admin

5. **Platform Invoicing**
   - Auto-generated monthly invoice for setup + subscription + top-ups consumed
   - Sent to tenant on billing date
   - Payment recording (manual for cash/bank, automated when you integrate JazzCash/Stripe/Razorpay)

6. **Suspension Workflow**
   - Day 1 of failed payment: warning email + in-app banner
   - Day 7: feature restrictions (AI disabled, exports disabled)
   - Day 14: account suspended (read-only access)
   - Day 30: data export emailed, account scheduled for deletion at day 90

---

## 7. PRICING DISPLAY (FOR YOUR MARKETING SITE)

When you build the marketing page, present pricing this way (psychology matters):

```
                    STARTER          PRO          BUSINESS       ENTERPRISE
                    PKR 2,500/mo     PKR 6,000    PKR 12,000     Custom
                    + PKR 20K setup  + PKR 20K    + PKR 20K      Talk to us

Users               5                15           50             Unlimited
Distributors        Unlimited        Unlimited    Unlimited      Unlimited
Clients             Unlimited        Unlimited    Unlimited      Unlimited
AI Assistant        —                ✓            ✓              ✓
AI Tokens/month     —                200K         1M             Custom
Inventory AI        —                ✓            ✓              ✓
Custom Branding     ✓                ✓            ✓              ✓
Multiple Dashboards ✓                ✓            ✓              ✓
Invoice Templates   1                3            Unlimited      Unlimited
Custom Domain       —                —            ✓              ✓
Priority Support    —                —            ✓              ✓
SLA                 —                —            —              99.9%
                    [Start trial]    [Most popular] [Start trial]   [Contact]
```

**Display tactics:**
- Highlight Pro as "Most Popular" (anchor effect — pulls people up from Starter)
- Show annual pricing toggle: 12 months for the price of 10 (17% discount, locks in revenue)
- Free 14-day trial on all paid plans, no card required (reduces signup friction)
- "Setup waived for annual plans" promotion can be your acquisition lever

---

## 8. FINAL RECOMMENDATION (BOTTOM LINE)

| Question | Answer |
|---|---|
| Setup fee? | **PKR 20,000 — keep it.** Filters tire-kickers, locks in commitment. |
| Pure pay-as-you-go? | **No.** Use Hybrid (subscription + token wallet). |
| Tokens per user? | **Yes, but optional.** Default is pool; per-user is Business+ feature. |
| PKR 2,000–3,000/month? | **Too low for AI.** Restructure to 4 tiers: PKR 2,500 / 6,000 / 12,000 / Custom. |
| Token markup? | **13x–28x cost.** Safe margin, room for promotions. |
| Auto-top-up? | **Yes, default ON.** Prevents disruption, smooths revenue. |
| Free trial? | **14 days, no card.** Industry standard, low friction. |

Now use this pricing model in the implementation. The next file gives you the step-by-step prompts to feed your AI coding tool.
