/* TIER 2 — REFERENCE TERMINOLOGY (AI-suggested, PENDING expert validation)
 * ============================================================================
 * Curated audiology / medical English↔Vietnamese terms NOT already covered by
 * Marie's expert-validated phrasebook (lib/glossary.js, from translations.html).
 *
 * These use standard, conservative medical Vietnamese consistent with the
 * conventions already in Marie's set (e.g. "thính lực", "màng nhĩ", "ốc tai",
 * "máy trợ thính"). They are SECONDARY guidance only — the translator is told
 * the authoritative glossary always wins on any conflict.
 *
 * VALIDATION WORKFLOW (for Marie / Tram):
 *  - Review the `vi` for each entry. Correct anything that isn't the wording
 *    you'd actually use with a Vietnamese patient.
 *  - When an entry is confirmed, set status:'validated' (or move the phrase
 *    into translations.html so it becomes tier-1 authoritative).
 *  - Entries left as status:'pending' are still used, but flagged to the model
 *    as not-yet-clinician-approved.
 */

/** @type {{en:string, vi:string, group:string, status:'pending'|'validated'}[]} */
const REFERENCE_TERMS = [
  // ── Ear anatomy ──
  { en: 'ear', vi: 'tai', group: 'anatomy', status: 'pending' },
  { en: 'outer ear', vi: 'tai ngoài', group: 'anatomy', status: 'pending' },
  { en: 'middle ear', vi: 'tai giữa', group: 'anatomy', status: 'pending' },
  { en: 'inner ear', vi: 'tai trong', group: 'anatomy', status: 'pending' },
  { en: 'ear canal', vi: 'ống tai', group: 'anatomy', status: 'pending' },
  { en: 'eardrum (tympanic membrane)', vi: 'màng nhĩ', group: 'anatomy', status: 'pending' },
  { en: 'cochlea', vi: 'ốc tai', group: 'anatomy', status: 'pending' },
  { en: 'auditory nerve', vi: 'dây thần kinh thính giác', group: 'anatomy', status: 'pending' },
  { en: 'hair cells', vi: 'tế bào lông (trong ốc tai)', group: 'anatomy', status: 'pending' },
  { en: 'ossicles (ear bones)', vi: 'chuỗi xương con (xương tai)', group: 'anatomy', status: 'pending' },
  { en: 'Eustachian tube', vi: 'vòi nhĩ (vòi Eustachian)', group: 'anatomy', status: 'pending' },
  { en: 'earwax (cerumen)', vi: 'ráy tai', group: 'anatomy', status: 'pending' },
  { en: 'balance / vestibular system', vi: 'hệ thống thăng bằng (tiền đình)', group: 'anatomy', status: 'pending' },

  // ── Hearing loss: type / degree / pattern ──
  { en: 'hearing loss', vi: 'mất thính lực', group: 'hearing-loss', status: 'pending' },
  { en: 'hearing', vi: 'thính lực / sức nghe', group: 'hearing-loss', status: 'pending' },
  { en: 'conductive hearing loss', vi: 'mất thính lực dẫn truyền', group: 'hearing-loss', status: 'pending' },
  { en: 'sensorineural hearing loss', vi: 'mất thính lực thần kinh giác quan', group: 'hearing-loss', status: 'pending' },
  { en: 'mixed hearing loss', vi: 'mất thính lực hỗn hợp', group: 'hearing-loss', status: 'pending' },
  { en: 'mild hearing loss', vi: 'mất thính lực nhẹ', group: 'hearing-loss', status: 'pending' },
  { en: 'moderate hearing loss', vi: 'mất thính lực trung bình', group: 'hearing-loss', status: 'pending' },
  { en: 'severe hearing loss', vi: 'mất thính lực nặng', group: 'hearing-loss', status: 'pending' },
  { en: 'profound hearing loss', vi: 'mất thính lực sâu (rất nặng)', group: 'hearing-loss', status: 'pending' },
  { en: 'normal hearing', vi: 'thính lực bình thường', group: 'hearing-loss', status: 'pending' },
  { en: 'high-frequency hearing loss', vi: 'mất thính lực ở tần số cao', group: 'hearing-loss', status: 'pending' },
  { en: 'gradual / progressive', vi: 'từ từ / tiến triển dần', group: 'hearing-loss', status: 'pending' },
  { en: 'sudden hearing loss', vi: 'mất thính lực đột ngột', group: 'hearing-loss', status: 'pending' },
  { en: 'in both ears', vi: 'ở cả hai tai', group: 'hearing-loss', status: 'pending' },
  { en: 'in the right ear', vi: 'ở tai phải', group: 'hearing-loss', status: 'pending' },
  { en: 'in the left ear', vi: 'ở tai trái', group: 'hearing-loss', status: 'pending' },

  // ── Tests & procedures ──
  { en: 'hearing test / evaluation', vi: 'kiểm tra thính lực', group: 'tests', status: 'pending' },
  { en: 'otoscopy (ear exam)', vi: 'soi tai', group: 'tests', status: 'pending' },
  { en: 'tympanometry', vi: 'đo nhĩ lượng (đo độ rung màng nhĩ)', group: 'tests', status: 'pending' },
  { en: 'pure-tone audiometry', vi: 'đo thính lực đơn âm', group: 'tests', status: 'pending' },
  { en: 'air conduction', vi: 'dẫn truyền qua không khí', group: 'tests', status: 'pending' },
  { en: 'bone conduction', vi: 'dẫn truyền qua xương', group: 'tests', status: 'pending' },
  { en: 'masking', vi: 'tạo tiếng ồn che (masking)', group: 'tests', status: 'pending' },
  { en: 'speech recognition test', vi: 'kiểm tra khả năng nghe hiểu lời nói', group: 'tests', status: 'pending' },
  { en: 'word recognition score', vi: 'điểm nhận biết từ', group: 'tests', status: 'pending' },
  { en: 'otoacoustic emissions (OAE)', vi: 'đo âm ốc tai (OAE)', group: 'tests', status: 'pending' },
  { en: 'auditory brainstem response (ABR)', vi: 'đo điện thính giác thân não (ABR)', group: 'tests', status: 'pending' },
  { en: 'newborn hearing screening', vi: 'sàng lọc thính lực sơ sinh', group: 'tests', status: 'pending' },
  { en: 'audiogram', vi: 'thính lực đồ (biểu đồ thính lực)', group: 'tests', status: 'pending' },
  { en: 'threshold', vi: 'ngưỡng nghe', group: 'tests', status: 'pending' },
  { en: 'frequency (pitch)', vi: 'tần số (cao độ âm thanh)', group: 'tests', status: 'pending' },
  { en: 'decibel (dB)', vi: 'đề-xi-ben (dB)', group: 'tests', status: 'pending' },
  { en: 'sound booth', vi: 'phòng cách âm', group: 'tests', status: 'pending' },
  { en: 'headphones / earphones', vi: 'tai nghe', group: 'tests', status: 'pending' },
  { en: 'probe', vi: 'đầu dò', group: 'tests', status: 'pending' },
  { en: 'press the button when you hear the sound', vi: 'bấm nút khi bạn nghe thấy âm thanh', group: 'tests', status: 'pending' },

  // ── Conditions / symptoms ──
  { en: 'age-related hearing loss (presbycusis)', vi: 'lão thính (mất thính lực do tuổi tác)', group: 'conditions', status: 'pending' },
  { en: 'noise-induced hearing loss', vi: 'mất thính lực do tiếng ồn', group: 'conditions', status: 'pending' },
  { en: 'tinnitus (ringing in the ears)', vi: 'ù tai', group: 'conditions', status: 'pending' },
  { en: 'dizziness', vi: 'chóng mặt', group: 'conditions', status: 'pending' },
  { en: 'vertigo', vi: 'chóng mặt quay cuồng', group: 'conditions', status: 'pending' },
  { en: 'balance problem', vi: 'mất thăng bằng', group: 'conditions', status: 'pending' },
  { en: 'ear infection', vi: 'nhiễm trùng tai / viêm tai', group: 'conditions', status: 'pending' },
  { en: 'middle ear infection (otitis media)', vi: 'viêm tai giữa', group: 'conditions', status: 'pending' },
  { en: 'fluid behind the eardrum', vi: 'dịch sau màng nhĩ', group: 'conditions', status: 'pending' },
  { en: 'ear pain', vi: 'đau tai', group: 'conditions', status: 'pending' },
  { en: 'ear fullness / pressure', vi: 'cảm giác đầy/nặng tai', group: 'conditions', status: 'pending' },
  { en: 'sound sensitivity (hyperacusis)', vi: 'nhạy cảm với âm thanh', group: 'conditions', status: 'pending' },
  { en: 'wax buildup (impacted cerumen)', vi: 'ráy tai bị tắc nghẽn', group: 'conditions', status: 'pending' },
  { en: 'perforated eardrum', vi: 'thủng màng nhĩ', group: 'conditions', status: 'pending' },
  { en: 'difficulty understanding speech', vi: 'khó nghe hiểu lời nói', group: 'conditions', status: 'pending' },

  // ── Devices & management ──
  { en: 'hearing aid', vi: 'máy trợ thính', group: 'devices', status: 'pending' },
  { en: 'behind-the-ear hearing aid', vi: 'máy trợ thính đeo sau tai', group: 'devices', status: 'pending' },
  { en: 'in-the-ear hearing aid', vi: 'máy trợ thính đặt trong tai', group: 'devices', status: 'pending' },
  { en: 'ear mold', vi: 'khuôn tai', group: 'devices', status: 'pending' },
  { en: 'dome / ear tip', vi: 'nút tai (dome)', group: 'devices', status: 'pending' },
  { en: 'hearing aid battery', vi: 'pin máy trợ thính', group: 'devices', status: 'pending' },
  { en: 'rechargeable', vi: 'sạc lại được', group: 'devices', status: 'pending' },
  { en: 'volume', vi: 'âm lượng', group: 'devices', status: 'pending' },
  { en: 'feedback (whistling)', vi: 'tiếng rít/hú (hồi tiếng)', group: 'devices', status: 'pending' },
  { en: 'cochlear implant', vi: 'cấy ốc tai điện tử (ốc tai điện tử)', group: 'devices', status: 'pending' },
  { en: 'speech/sound processor', vi: 'bộ xử lý âm thanh', group: 'devices', status: 'pending' },
  { en: 'electrode array', vi: 'dãy điện cực', group: 'devices', status: 'pending' },
  { en: 'activation / mapping', vi: 'kích hoạt / hiệu chỉnh thiết bị', group: 'devices', status: 'pending' },
  { en: 'hearing protection (earplugs)', vi: 'đồ bảo vệ tai (nút bịt tai)', group: 'devices', status: 'pending' },
  { en: 'fitting / adjustment appointment', vi: 'buổi hẹn chỉnh máy', group: 'devices', status: 'pending' },
  { en: 'follow-up appointment', vi: 'buổi hẹn tái khám', group: 'devices', status: 'pending' },
  { en: 'referral to an ENT doctor', vi: 'giới thiệu đến bác sĩ tai mũi họng', group: 'devices', status: 'pending' },
  { en: 'audiologist', vi: 'chuyên viên thính học', group: 'devices', status: 'pending' },

  // ── General clinical / logistics ──
  { en: 'appointment', vi: 'cuộc hẹn', group: 'clinical', status: 'pending' },
  { en: 'insurance', vi: 'bảo hiểm', group: 'clinical', status: 'pending' },
  { en: 'medical history', vi: 'tiền sử bệnh', group: 'clinical', status: 'pending' },
  { en: 'medication', vi: 'thuốc', group: 'clinical', status: 'pending' },
  { en: 'allergy', vi: 'dị ứng', group: 'clinical', status: 'pending' },
  { en: 'symptom', vi: 'triệu chứng', group: 'clinical', status: 'pending' },
  { en: 'diagnosis', vi: 'chẩn đoán', group: 'clinical', status: 'pending' },
  { en: 'treatment', vi: 'điều trị', group: 'clinical', status: 'pending' },
  { en: 'results', vi: 'kết quả', group: 'clinical', status: 'pending' },
  { en: 'recommendation', vi: 'khuyến nghị / đề nghị', group: 'clinical', status: 'pending' },
  { en: 'consent form', vi: 'mẫu đơn đồng ý', group: 'clinical', status: 'pending' },
  { en: 'interpreter', vi: 'thông dịch viên', group: 'clinical', status: 'pending' },
  { en: 'family member', vi: 'người thân trong gia đình', group: 'clinical', status: 'pending' },
];

export default REFERENCE_TERMS;
