import React from "react";
import { Helmet } from "react-helmet-async";
import type { BreadcrumbItem } from "./Breadcrumbs";

interface SeoPageHeadProps {
  title: string;
  description: string;
  canonicalPath: string;
  image?: string;
  keywords?: string[];
  breadcrumbs?: BreadcrumbItem[];
  schema?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const DEFAULT_IMAGE = "https://www.ancavisuals.ro/android-chrome-512x512.png";

const SeoPageHead: React.FC<SeoPageHeadProps> = ({
  title,
  description,
  canonicalPath,
  image = DEFAULT_IMAGE,
  keywords,
  breadcrumbs,
  schema,
}) => {
  const canonicalUrl = `https://www.ancavisuals.ro${canonicalPath}`;
  const graph: Array<Record<string, unknown>> = [];

  if (breadcrumbs?.length) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonicalUrl}#breadcrumbs`,
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.label,
        item: item.to ? `https://www.ancavisuals.ro${item.to}` : canonicalUrl,
      })),
    });
  }

  if (Array.isArray(schema)) {
    graph.push(...schema);
  } else if (schema) {
    graph.push(schema);
  }

  const schemaPayload =
    graph.length > 0
      ? {
          "@context": "https://schema.org",
          "@graph": graph,
        }
      : null;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index,follow,max-image-preview:large" />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={image} />
      <meta property="og:locale" content="ro_RO" />
      <meta name="twitter:card" content="summary_large_image" />
      {keywords?.length ? <meta name="keywords" content={keywords.join(", ")} /> : null}
      {schemaPayload ? (
        <script type="application/ld+json">{JSON.stringify(schemaPayload)}</script>
      ) : null}
    </Helmet>
  );
};

export default SeoPageHead;
