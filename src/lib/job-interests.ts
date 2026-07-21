/** Canonical job-interest options used at signup, settings, and feed ranking. */
export const JOB_INTEREST_OPTIONS = [
  {
    id: "trades_repairs",
    label: "Trades and Repairs",
    emoji: "🔧",
    keywords: ["trade", "repair", "plumb", "electric", "carpentry", "mechanic", "fix", "install"],
  },
  {
    id: "cleaning_domestic",
    label: "Cleaning and Domestic",
    emoji: "🧹",
    keywords: ["clean", "domestic", "housekeep", "laundry", "janitor"],
  },
  {
    id: "delivery_errands",
    label: "Delivery and Errands",
    emoji: "🚚",
    keywords: ["deliver", "errand", "logistics", "courier", "dispatch", "ride"],
  },
  {
    id: "digital_tech",
    label: "Digital and Tech Tasks",
    emoji: "💻",
    keywords: ["digital", "tech", "computer", "website", "app", "data", "software", "it "],
  },
  {
    id: "writing_admin",
    label: "Writing and Admin",
    emoji: "📝",
    keywords: ["writ", "admin", "typ", "transcri", "virtual assist", "document", "content"],
  },
  {
    id: "cooking_catering",
    label: "Cooking and Catering",
    emoji: "🍳",
    keywords: ["cook", "cater", "food", "chef", "bake", "kitchen"],
  },
  {
    id: "gardening_outdoor",
    label: "Gardening and Outdoor",
    emoji: "🌿",
    keywords: ["garden", "outdoor", "landscap", "farm", "plant", "lawn"],
  },
  {
    id: "caregiving_teaching",
    label: "Caregiving and Teaching",
    emoji: "🤝",
    keywords: ["care", "teach", "tutor", "nanny", "child", "elder", "lesson"],
  },
] as const;

export type JobInterestId = (typeof JOB_INTEREST_OPTIONS)[number]["id"];

export function jobInterestLabel(id: string): string {
  return JOB_INTEREST_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

/** Score how well a job title/description matches selected interest ids (higher = better). */
export function scoreJobAgainstInterests(
  title: string,
  description: string | null | undefined,
  interests: string[] | null | undefined,
): number {
  if (!interests?.length) return 0;
  const hay = `${title} ${description ?? ""}`.toLowerCase();
  let score = 0;
  for (const id of interests) {
    const opt = JOB_INTEREST_OPTIONS.find((o) => o.id === id);
    if (!opt) continue;
    if (hay.includes(opt.label.toLowerCase())) score += 5;
    for (const kw of opt.keywords) {
      if (hay.includes(kw)) score += 2;
    }
  }
  return score;
}
