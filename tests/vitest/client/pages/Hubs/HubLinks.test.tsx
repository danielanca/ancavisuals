import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CitiesHubPage from "src/client/pages/Hubs/CitiesHubPage";
import ServiceHubPage from "src/client/pages/Hubs/ServiceHubPage";
import { ALL_LOCATION_ROUTES, SERVICE_HUB_SLUGS } from "src/client/pages/LocationSEO/locationData";

vi.mock("src/client/components/Navbar/Navbar", () => ({ default: () => null }));
vi.mock("src/client/components/Navbar/Footer", () => ({ default: () => null }));
vi.mock("src/client/components/SEO/SeoPageHead", () => ({ default: () => null }));

const validPaths = new Set([
  ...ALL_LOCATION_ROUTES.map(route => route.path),
  ...SERVICE_HUB_SLUGS.map(slug => `/foto-video-${slug}`),
]);

function linksFor(page: React.ReactElement) {
  const { container } = render(<MemoryRouter>{page}</MemoryRouter>);
  return Array.from(container.querySelectorAll('a[href^="/foto-video-"]'), link => link.getAttribute("href")!);
}

describe("public hub links", () => {
  it("links only to registered location/service pages, including wedding-only towns", () => {
    const links = linksFor(<CitiesHubPage />);
    expect(links).toContain("/foto-video-nunta-ocna-sibiului");
    expect(links).toContain("/foto-video-nunta-sanmartin-bihor");
    expect(links).not.toContain("/foto-video-inmormantare-ocna-sibiului");
    expect(links).not.toContain("/foto-video-corporate-sanmartin-bihor");
    expect(links).not.toContain("/foto-video-corporate");
    expect(links.filter(path => !validPaths.has(path))).toEqual([]);
  });

  it.each(SERVICE_HUB_SLUGS)("%s overview links only to existing local pages", serviceSlug => {
    const links = linksFor(<ServiceHubPage serviceSlug={serviceSlug} />);
    expect(links.length).toBeGreaterThan(0);
    expect(links).toContain(`/foto-video-${serviceSlug}-sibiu`);
    expect(links.includes(`/foto-video-${serviceSlug}-ocna-sibiului`)).toBe(serviceSlug === "nunta");
    expect(links.filter(path => !validPaths.has(path))).toEqual([]);
  });
});
