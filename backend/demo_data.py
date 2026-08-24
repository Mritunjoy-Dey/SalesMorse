"""Preloaded demo accounts (3): Brightline Analytics, Nimbus DevOps, Zenith Retail."""

DEFAULT_ACCOUNT_ID = "brightline"

DEMO_ACCOUNTS = {
    "brightline": {
        "id": "brightline",
        "name": "Brightline Analytics",
        "tagline": "Negotiation · procurement risk · contradiction",
        "files": [
            {
                "id": "demo-brightline-crm",
                "filename": "brightline_crm_note.txt",
                "source_type": "crm",
                "content": (
                    "Account: Brightline Analytics\n"
                    "Deal Stage: Negotiation\n"
                    "Owner: Maya Chen\n"
                    "Last Updated: 3 days ago\n\n"
                    "Notes: Budget approved by VP Ops (Raj Kapoor) on last call. Deal size "
                    "~$42K ACV. Champion is Priya Sharma (Head of RevOps), strong advocate "
                    "internally. Economic buyer confirmed as Raj Kapoor. Timeline: prospect "
                    "wants to close before end of quarter if procurement clears. "
                    "Competitor mentioned once in passing during discovery — they had "
                    "briefly evaluated Clearview before reaching out to us."
                ),
            },
            {
                "id": "demo-brightline-email",
                "filename": "priya_budget_email.txt",
                "source_type": "email",
                "content": (
                    "From: Priya Sharma <priya@brightlineanalytics.com>\n"
                    "To: Maya Chen\n"
                    "Subject: Re: Budget question\n\n"
                    "Hi Maya,\n\n"
                    "Following up after yesterday's call — wanted to flag that finance is "
                    "actually still reviewing the Q3 allocation. Raj mentioned approval on "
                    "the call but procurement told me this morning it's not locked yet, "
                    "they're still finalizing the budget on hold pending the Q3 planning "
                    "meeting next week.\n\n"
                    "Separately — timeline-wise, I think we could realistically close "
                    "maybe Q3, depending on how procurement moves. Wanted to be upfront "
                    "so there are no surprises.\n\n"
                    "Best,\nPriya"
                ),
            },
            {
                "id": "demo-brightline-transcript",
                "filename": "discovery_call_transcript.txt",
                "source_type": "transcript",
                "content": (
                    "[Discovery Call — 34 min — Maya Chen, Priya Sharma, Raj Kapoor]\n\n"
                    "Raj: ...yeah, budget's approved on our end, we just need procurement "
                    "to process it.\n\n"
                    "Priya: Right, and to be clear that's pending the Q3 planning cycle, "
                    "so I don't want to overstate where we are.\n\n"
                    "Maya: Understood. And in terms of what's driving urgency for you "
                    "this quarter?\n\n"
                    "Raj: Honestly our reporting process is a mess right now, we're "
                    "stitching together three tools manually every week. We looked at "
                    "Clearview earlier this year but their onboarding timeline was too "
                    "long for what we needed.\n\n"
                    "Priya: Agreed, that's really the main pain point — the manual "
                    "reporting overhead, not the tool cost itself.\n\n"
                    "Maya: Got it, and are there other stakeholders who'd need to weigh "
                    "in before we move forward?\n\n"
                    "Raj: Just procurement at this point, and maybe our CFO if it goes "
                    "above a certain threshold, but I don't expect that to be an issue."
                ),
            },
        ],
    },
    "nimbus": {
        "id": "nimbus",
        "name": "Nimbus DevOps",
        "tagline": "Technical eval · SSO/SOC2 gate · possibly delayed",
        "files": [
            {
                "id": "demo-nimbus-crm",
                "filename": "nimbus_crm_note.txt",
                "source_type": "crm",
                "content": (
                    "Account: Nimbus DevOps\n"
                    "Deal Stage: Technical Evaluation\n"
                    "Owner: Alex Rivera\n"
                    "Last Updated: yesterday\n\n"
                    "Notes: Mid-market DevOps platform, ~250 engineers. Currently running a "
                    "30-day POC. Champion: Dana Wu (Staff Platform Engineer). Economic buyer "
                    "likely CTO Ben Ortiz — not yet directly engaged. Deal size projected "
                    "$78K ACV pending seat count. Hard requirement: SOC2 Type II report and "
                    "SAML SSO. Security review scheduled next Tuesday. Compared against "
                    "Datadog and PagerDuty in initial vendor list; we made the shortlist on "
                    "pricing and Terraform provider quality."
                ),
            },
            {
                "id": "demo-nimbus-email",
                "filename": "dana_security_email.txt",
                "source_type": "email",
                "content": (
                    "From: Dana Wu <dana@nimbusdevops.io>\n"
                    "To: Alex Rivera\n"
                    "Subject: Heads-up on security review\n\n"
                    "Hey Alex,\n\n"
                    "Quick heads-up — our security team pushed the review back by a week, "
                    "possibly two. They're swamped with a separate vendor audit and can't "
                    "look at the SOC2 report until then. I still think we can wrap the "
                    "eval this quarter but it's tight.\n\n"
                    "Also, Ben wants to see actual pricing before he'll get involved. Can "
                    "you send the enterprise tier sheet with the SSO add-on line-itemed? "
                    "Last time we discussed it verbally and he wasn't sure if SSO was "
                    "bundled or extra.\n\n"
                    "— Dana"
                ),
            },
            {
                "id": "demo-nimbus-transcript",
                "filename": "poc_checkin_transcript.txt",
                "source_type": "transcript",
                "content": (
                    "[POC check-in — 22 min — Alex Rivera, Dana Wu]\n\n"
                    "Alex: How's the POC going on your side?\n\n"
                    "Dana: Honestly pretty good. The Terraform provider is a big win — my "
                    "team was skeptical at first but they've stopped complaining, which "
                    "is basically a rave review from platform engineers.\n\n"
                    "Alex: Glad to hear it. Any blockers I should know about?\n\n"
                    "Dana: The main one is still SOC2. Ben won't sign anything without "
                    "the Type II report on file. And SSO — we're a SAML shop, not OIDC, so "
                    "we need SAML on day one, not roadmap.\n\n"
                    "Alex: Both are covered — SOC2 Type II is current as of last month, "
                    "and SAML is GA.\n\n"
                    "Dana: Good. Last thing — pricing. Ben's expecting a number under "
                    "$90K for the first year. If we come in above that he'll push back "
                    "hard, maybe kill it."
                ),
            },
        ],
    },
    "zenith": {
        "id": "zenith",
        "name": "Zenith Retail",
        "tagline": "Competitive displacement · incumbent renewal window",
        "files": [
            {
                "id": "demo-zenith-crm",
                "filename": "zenith_crm_note.txt",
                "source_type": "crm",
                "content": (
                    "Account: Zenith Retail\n"
                    "Deal Stage: Discovery → Proposal\n"
                    "Owner: Kai Nakamura\n"
                    "Last Updated: this morning\n\n"
                    "Notes: 380-store retail chain, currently on Salesforce for CRM and "
                    "Talkdesk for contact center. Renewal window opens in 6 weeks. "
                    "Champion: Lena Rodrigues (VP CX). Economic buyer: COO Marcus Adeyemi. "
                    "Trigger event: two failed launches with Talkdesk caused significant "
                    "downtime during last holiday season. Deal size potential $310K ACV. "
                    "Lena is openly frustrated with incumbent; Marcus is more cautious — "
                    "wants proof of migration path before committing."
                ),
            },
            {
                "id": "demo-zenith-email",
                "filename": "lena_migration_email.txt",
                "source_type": "email",
                "content": (
                    "From: Lena Rodrigues <lena@zenithretail.com>\n"
                    "To: Kai Nakamura\n"
                    "Subject: Migration timeline concerns\n\n"
                    "Kai,\n\n"
                    "I want to be direct — I'm sold, but Marcus is not. His concern is "
                    "purely migration risk. Last holiday season we had two outages during "
                    "Black Friday because of Talkdesk config drift, and he does not want a "
                    "repeat this year.\n\n"
                    "If we can show him a 60-day migration plan with a rollback checkpoint, "
                    "I think we get him. If it looks longer than that or has no rollback, "
                    "he'll wait another cycle and renew Talkdesk for 12 more months.\n\n"
                    "Timeline-wise, we need to sign by end of next month to hit the switchover "
                    "before peak season prep starts.\n\n"
                    "Lena"
                ),
            },
            {
                "id": "demo-zenith-transcript",
                "filename": "coo_call_transcript.txt",
                "source_type": "transcript",
                "content": (
                    "[Exec briefing — 41 min — Kai, Lena, Marcus]\n\n"
                    "Marcus: Look, I'll be honest with you. My concern isn't your product. "
                    "My concern is the migration.\n\n"
                    "Kai: Understood. What would make you comfortable?\n\n"
                    "Marcus: A rollback plan I can actually execute. If we're 30 days in "
                    "and something isn't right, I need a button that puts us back on "
                    "Talkdesk without losing tickets.\n\n"
                    "Lena: We also need to keep our Salesforce object model intact. We can't "
                    "re-map 40 custom fields.\n\n"
                    "Kai: Both are addressable. Our Salesforce sync is bi-directional and "
                    "field-mapping is config not code.\n\n"
                    "Marcus: What about the incumbent's contract? We're locked in until the "
                    "renewal window, but if we sign with you before then we're paying twice.\n\n"
                    "Lena: The renewal window opens in six weeks. If we don't sign with them "
                    "by then, we're free to move.\n\n"
                    "Marcus: Then that's the deadline. Get me the rollback plan and the "
                    "migration timeline, and we can move fast — but I won't sign until I see "
                    "them in writing."
                ),
            },
        ],
    },
}


def get_all_file_ids():
    ids = set()
    for acct in DEMO_ACCOUNTS.values():
        for f in acct["files"]:
            ids.add(f["id"])
    return ids


DEMO_FILE_IDS = get_all_file_ids()

# Back-compat exports
DEMO_ACCOUNT = DEMO_ACCOUNTS[DEFAULT_ACCOUNT_ID]["name"]
DEMO_FILES = DEMO_ACCOUNTS[DEFAULT_ACCOUNT_ID]["files"]


def account_files_by_id(account_id: str):
    acct = DEMO_ACCOUNTS.get(account_id) or DEMO_ACCOUNTS[DEFAULT_ACCOUNT_ID]
    return acct["files"], acct["name"]
