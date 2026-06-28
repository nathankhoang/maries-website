/* Audiology domain primer — injected into the translator's system prompt.
 *
 * This is established, source-grounded ENGLISH audiology knowledge plus
 * translation guidance. It carries NO unvalidated Vietnamese, so it improves
 * the model's clinical reasoning safely. Sources: ASHA terminology guidance,
 * NIH/NCBI StatPearls (audiogram interpretation, cochlear implants), NIDCD,
 * and standard audiology references. Expand as needed; no expert sign-off
 * required for the English/contextual content here.
 */

const DOMAIN_CONTEXT = `AUDIOLOGY DOMAIN KNOWLEDGE — use this to interpret the source text correctly before translating. Choose the audiology sense of any ambiguous word.

EAR ANATOMY:
- Outer ear: pinna/auricle, ear canal (external auditory canal), eardrum (tympanic membrane).
- Middle ear: air-filled cavity behind the eardrum; ossicles = malleus (hammer), incus (anvil), stapes (stirrup); Eustachian tube connects to the throat and equalizes pressure.
- Inner ear: cochlea (hearing organ, contains hair cells), vestibular system (balance: semicircular canals, utricle, saccule), auditory/cochlear nerve (cranial nerve VIII) carrying signal to the brain.

HEARING LOSS — TYPE, DEGREE, CONFIGURATION:
- Type: Conductive (outer/middle ear; e.g., wax, fluid, perforation, otosclerosis), Sensorineural (cochlea or auditory nerve; usually permanent), Mixed (both), Auditory neuropathy.
- Degree (dB HL): normal (-10–15/25), mild (26–40), moderate (41–55), moderately severe (56–70), severe (71–90), profound (91+).
- Configuration: high-frequency (sloping), low-frequency (rising), flat, notched (noise-related 3–6 kHz "noise notch"), cookie-bite.
- Onset/side: sudden vs gradual/progressive; unilateral vs bilateral; symmetric vs asymmetric; right ear vs left ear.

KEY TESTS / PROCEDURES (interpret these names in their clinical sense):
- Otoscopy (visual ear exam); Tympanometry / immittance (eardrum mobility, middle-ear pressure → tympanogram); Acoustic reflex.
- Pure-tone audiometry: air conduction (headphones/inserts) and bone conduction (bone oscillator on the mastoid); thresholds plotted on an audiogram (X = frequency in Hz, Y = intensity in dB HL).
- Masking (noise to the non-test ear so the test ear is measured accurately).
- Speech tests: SRT (Speech Recognition/Reception Threshold), WRS/word recognition, speech-in-noise.
- Objective tests: OAE (otoacoustic emissions — cochlear/outer-hair-cell screen), ABR/BAER (auditory brainstem response), ASSR; newborn hearing screening.
- Real-ear measurement (REM) and hearing-aid verification/fitting.

COMMON CONDITIONS: presbycusis (age-related), noise-induced hearing loss (NIHL), otitis media (middle-ear infection/effusion), cerumen impaction (earwax), otosclerosis, sudden sensorineural hearing loss (medical urgency), Ménière's disease, BPPV and other vestibular/balance disorders, tinnitus (ringing), hyperacusis (sound sensitivity), acoustic neuroma/vestibular schwannoma, ototoxicity.

DEVICES & MANAGEMENT: hearing aids (BTE/RIC/ITE/ITC/CIC; receiver, ear mold, dome, battery, tubing, microphone, telecoil, Bluetooth/streaming); cochlear implant (external: microphone, speech/sound processor, headpiece/coil; internal: implant + electrode array; activation/mapping); bone-conduction/bone-anchored devices; assistive listening devices (FM/DM, loop); hearing protection (earplugs, earmuffs); aural rehabilitation, communication strategies, follow-up and ear care.

TRANSLATION GUIDANCE:
- Register: a clinician speaking directly to a patient — clear, warm, plain-language; explain jargon the way an audiologist would when the patient is a layperson.
- Preserve exactly: numbers, frequencies (Hz/kHz), decibels (dB), ear side (right/left/both), test names, brand/model names, and dosages.
- Keep questions as natural patient-facing questions; keep instructions as direct, gentle instructions.
- For Vietnamese output, use the "bạn" placeholder for the second-person pronoun (the clinician substitutes the age/relationship-appropriate pronoun). Do not invent a specific pronoun.
- Do not add diagnosis, advice, or commentary — translate only.`;

export default DOMAIN_CONTEXT;
