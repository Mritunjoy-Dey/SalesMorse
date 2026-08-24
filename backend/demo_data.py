"""Preloaded demo account: Brightline Analytics."""

DEMO_ACCOUNT = "Brightline Analytics"

DEMO_FILE_IDS = {"demo-crm-note", "demo-email-thread", "demo-call-transcript"}

DEMO_FILES = [
    {
        "id": "demo-crm-note",
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
        "id": "demo-email-thread",
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
        "id": "demo-call-transcript",
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
]
