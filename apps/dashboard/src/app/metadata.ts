import type { Metadata } from "next";

export const TITLE = "ManyLead";
export const DESCRIPTION =
  "All-in-one platform for managing leads, CRM, and customer relationships.";

export const defaultMetadata: Metadata = {
  title: {
    template: `%s | ${TITLE}`,
    default: TITLE,
  },
  description: DESCRIPTION,
  metadataBase: new URL("https://www.manylead.com"),
};

export const twitterMetadata: Metadata["twitter"] = {
  title: TITLE,
  description: DESCRIPTION,
  card: "summary_large_image",
};

export const ogMetadata: Metadata["openGraph"] = {
  title: TITLE,
  description: DESCRIPTION,
  type: "website",
};
