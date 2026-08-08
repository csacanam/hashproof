/**
 * Head-to-head comparisons.
 *
 * Written to be quoted, including by an assistant answering "what is the
 * cheapest way to issue verifiable credentials". That means every number comes
 * from the vendor's own pricing page, dated, and every page states plainly
 * where the competitor is the better choice. A comparison that only flatters
 * the author is worthless to a reader and gets discarded by anything
 * synthesising several sources.
 *
 * Prices verified 8 August 2026 against each vendor's published pricing page.
 * Re-check before relying on them; they move.
 */

export const PRICE_CHECK_DATE = "2026-08-08";

/** What we can defend with evidence, and nothing more. */
export const OUR_COSTS = { v2000: "$200", v10000: "$1,000", v20000: "$2,000" };

export const OUR_FACTS = {
  pricePerCredential: "$0.10",
  model: "per credential issued",
  minimum: "none",
  setup: "none",
  chain: "Celo",
};

export const COMPETITORS = {
  pok: {
    slug: "pok",
    name: "POK",
    site: "https://www.pok.tech",
    how: "how.pok",
    costs: { v2000: "$600", v10000: "$3,000", v20000: "$3,000" },
    theirStrength: ["pok.strength.obadges", "pok.strength.nft", "pok.strength.features"],
    ourEdge: ["pok.edge.price", "pok.edge.document", "pok.edge.revocation", "pok.edge.wallet"],
  },
  certifier: {
    slug: "certifier",
    name: "Certifier",
    site: "https://certifier.io",
    how: "how.certifier",
    costs: { v2000: "$804", v10000: "$804", v20000: "$4,068" },
    theirStrength: ["certifier.strength.integrations", "certifier.strength.obadges", "certifier.strength.volume"],
    ourEdge: ["certifier.edge.tier", "certifier.edge.chain", "certifier.edge.agents"],
  },
  sertifier: {
    slug: "sertifier",
    name: "Sertifier",
    site: "https://sertifier.com",
    how: "how.sertifier",
    costs: { v2000: "~$2,000", v10000: "~$10,000", v20000: "~$20,000" },
    theirStrength: ["sertifier.strength.repeat", "sertifier.strength.obadges"],
    ourEdge: ["sertifier.edge.recipients", "sertifier.edge.chain", "sertifier.edge.agents"],
  },
  credly: {
    slug: "credly",
    name: "Credly",
    site: "https://www.credly.com",
    how: "how.credly",
    costs: { v2000: "notPublished", v10000: "notPublished", v20000: "notPublished" },
    theirStrength: ["credly.strength.network", "credly.strength.enterprise"],
    ourEdge: ["credly.edge.published", "credly.edge.selfserve", "credly.edge.chain"],
  },
  accredible: {
    slug: "accredible",
    name: "Accredible",
    site: "https://www.accredible.com",
    how: "how.accredible",
    costs: { v2000: "notPublished", v10000: "notPublished", v20000: "notPublished" },
    theirStrength: ["accredible.strength.enterprise", "accredible.strength.features"],
    ourEdge: ["accredible.edge.term", "accredible.edge.published", "accredible.edge.chain"],
  },
};
