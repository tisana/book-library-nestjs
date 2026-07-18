# Shared Sign-In Moderated Usability Evidence

## Release Status

**NOT CONDUCTED - PRODUCTION RELEASE BLOCKED**

SC-006 requires exactly 20 first-time participants: 8 members, 8 staff users, and 4 administrators. Product owner or QA must conduct the sessions and replace only the aggregate result fields below. Do not record credentials, tokens, names, email addresses, member numbers, video, audio, or participant-level notes in this file.

Pass requires at least 19 of 20 participants to reach the correct authorized landing area on the first attempt within 30 seconds. Missing participants, a cohort-size mismatch, or an unsigned result leaves the gate blocked.

## Consent Language

Read before each session:

> We are evaluating the sign-in experience, not you. Participation is voluntary and you may stop at any time. We will record only your assigned role, whether you completed sign-in on the first attempt, whether completion was within 30 seconds, and anonymized usability observations. We will not record your credentials, account identifier, token, name, audio, or video. Do you consent to continue?

Record only the aggregate count of participants who consented. A participant who does not consent is not enrolled and must be replaced to preserve the required cohort.

## Moderator Setup

1. Use a production-like build with the shared `/login` page and a clean browser profile.
2. Prepare 8 active member accounts, 8 active staff accounts, and 4 active administrator accounts with valid credentials. Do not reuse a participant across roles.
3. Confirm each account lands in its authorized area and cannot enter a higher-privilege area before recruitment begins.
4. Give credentials privately immediately before the task. Never place credentials in this evidence file.
5. Start each participant at `/login`; do not identify which resolver context will match the supplied identifier.
6. Use a monotonic timer. Do not coach, point, or explain controls after timing starts.

## Role Goals

| Cohort | Count | Goal shown to participant | Successful landing area |
| --- | ---: | --- | --- |
| Member | 8 | Sign in and open your library account | Member self-service (`/member`) |
| Staff | 8 | Sign in and open the library back office | Staff dashboard (`/staff`) without admin-only navigation |
| Administrator | 4 | Sign in and open staff access administration | Staff area with authorized administrator navigation |

## Moderated Script

1. Read the consent language and obtain verbal consent.
2. Say: "Use these valid credentials to sign in and reach the stated goal. Begin when ready."
3. Start timing when the participant first focuses or interacts with the sign-in form after saying they are ready.
4. Stop timing when the authorized landing area is visibly loaded and interactive.
5. Do not stop on an intermediate loading screen, wrong role area, `/unauthorized`, or a validation error.
6. After timing, ask: "Was any label, validation message, or navigation outcome unclear?" Record only a short anonymized theme.
7. Reset all browser state before the next participant.

## Definitions

- **First attempt success**: one submission with the supplied valid credentials reaches the correct authorized landing area. A validation failure, duplicate submission, wrong landing area, reload caused by confusion, or second submission is a first-attempt failure.
- **Within 30 seconds**: elapsed time is at most `30.000` seconds from the defined start to the defined interactive landing state.
- **Role success**: member reaches member self-service; staff reaches staff back office without administrator access; administrator reaches the staff area with administrator navigation.
- **Technical interruption**: infrastructure failure before a meaningful attempt. Discard the session, document only the aggregate interruption count, correct the environment, and recruit a replacement.
- **Keyboard-only observation**: when scheduled, the participant completes without a pointing device. This is recorded as an aggregate observation and does not replace first-attempt/timing criteria.

## Aggregate Results Template

Do not add participant rows.

| Cohort | Required | Conducted | First-attempt success | First-attempt within 30s | Correct landing | Keyboard-only completed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Member | 8 | 0 | 0 | 0 | 0 | 0 |
| Staff | 8 | 0 | 0 | 0 | 0 | 0 |
| Administrator | 4 | 0 | 0 | 0 | 0 | 0 |
| **Total** | **20** | **0** | **0** | **0** | **0** | **0** |

- Consented participants: `0`
- Technical interruptions replaced: `0`
- First-attempt and within-30-seconds total: `0/20`
- Aggregate anonymized observations: `Not yet collected`
- Result: `NOT CONDUCTED`
- SC-006 gate: `BLOCKED`
- Study date: `Not set`
- Environment/build identifier: `Not set`
- Product owner or QA name/role: `Not set`
- Product owner or QA approval date: `Not set`

## Sign-Off Rule

Change the result to `PASS` only when all cohort counts equal their required values, at least 19 participants satisfy both first-attempt and 30-second criteria, all 20 reach the correct role landing area, and product owner or QA signs the aggregate record. Otherwise set the result to `FAIL` and keep production blocked until the product owner changes the specification or a new complete study passes.
