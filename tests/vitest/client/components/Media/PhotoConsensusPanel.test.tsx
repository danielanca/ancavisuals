/*
 * Purpose: the common selection of one album — photos in album order by default, a Top by score,
 * filters by number of stars (votes), scored only among the people who reached each photo.
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PhotoConsensusPanel from "src/client/components/Media/PhotoConsensusPanel";
import { PHOTO_REVIEWERS, type PhotoVote, type PhotoReviewerId } from "src/shared/media/proposalConsensus";

const photoVotes = (fileName: string, photoIndex: number, reviewers: PhotoReviewerId[], destinations: PhotoVote["destinations"] = ["instagram", "media_assets"]): PhotoVote[] =>
  reviewers.map(reviewer => ({ id: `${fileName}-${reviewer}`, fileName, albumSlug: "album", photoUrl: `https://cdn.test/${fileName}`,
    reviewerId: reviewer, proposedBy: reviewer, destinations, photoIndex }));
const proposals = [
  ...photoVotes("one.jpg", 0, ["salomeea"], ["media_assets"]),
  ...photoVotes("unanimous.jpg", 4, ["daniel", "estera", "salomeea"]),
  ...photoVotes("two.jpg", 2, ["daniel", "estera"], ["instagram"]),
];
const coverage = { total: 10, seen: { daniel: 10, estera: 10, salomeea: 10 } };
const order = () => screen.getAllByRole("img").map(img => img.getAttribute("alt"));

describe("PhotoConsensusPanel", () => {
  test("without a filter, photos keep the album order", () => {
    render(<PhotoConsensusPanel proposals={proposals} coverage={coverage} />);
    expect(order()).toEqual(["one.jpg", "two.jpg", "unanimous.jpg"]);
  });

  test("Top puts the best score first and numbers the photos", () => {
    render(<PhotoConsensusPanel proposals={proposals} coverage={coverage} />);
    fireEvent.click(screen.getByRole("button", { name: "🏆 Top" }));
    expect(order()).toEqual(["unanimous.jpg", "two.jpg", "one.jpg"]);
    expect(screen.getByText(/#1 ·/)).toBeInTheDocument();
  });

  test("star filters show exactly that many votes", () => {
    render(<PhotoConsensusPanel proposals={proposals} coverage={coverage} />);
    fireEvent.click(screen.getByRole("button", { name: /2 stele \(1\)/ }));
    expect(order()).toEqual(["two.jpg"]);
    fireEvent.click(screen.getByRole("button", { name: /1 stea \(1\)/ }));
    expect(order()).toEqual(["one.jpg"]);
    expect(screen.getByText("Au văzut-o, n-au ales-o: Daniel, Estera")).toBeInTheDocument();
  });

  test("someone who hasn't reached a photo doesn't count against it", () => {
    const late = [...proposals, ...photoVotes("late.jpg", 7, ["daniel", "salomeea"])];
    render(<PhotoConsensusPanel proposals={late} coverage={{ total: 10, seen: { daniel: 10, estera: 3, salomeea: 10 } }} />);
    expect(screen.getByLabelText("Cât a parcurs fiecare").textContent).toContain("Estera · 3/10");
    // Photo 8: Estera stopped at 3, so it's 2 of the 2 who saw it — not 2 of 3.
    const card = screen.getByAltText("late.jpg").closest("article")!;
    expect(within(card).getByText(/2 din 2 · 100%/)).toBeInTheDocument();
    expect(within(card).getByText("N-au ajuns încă la ea: Estera")).toBeInTheDocument();
    // Photo 3 was seen by everyone: one vote of three.
    const one = screen.getByAltText("one.jpg").closest("article")!;
    expect(within(one).getByText(/1 din 3/)).toBeInTheDocument();
  });

  test("progress per person, and filters by destination, person and decision", () => {
    const decided = proposals.map(proposal => proposal.fileName === "two.jpg" ? { ...proposal, status: "accepted" as const } : proposal);
    render(<PhotoConsensusPanel proposals={decided} coverage={{ total: 10, seen: { daniel: 10, estera: 10, salomeea: 6 } }} reviewers={PHOTO_REVIEWERS} />);
    expect(screen.getByLabelText("Cât a parcurs fiecare").textContent).toContain("Salomeea · 6/10");
    fireEvent.change(screen.getByRole("combobox", { name: "Destinația voturilor" }), { target: { value: "media_assets" } });
    expect(order()).toEqual(["one.jpg", "unanimous.jpg"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Destinația voturilor" }), { target: { value: "all" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Persoana care a votat" }), { target: { value: "daniel" } });
    expect(order()).toEqual(["two.jpg", "unanimous.jpg"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Decizia" }), { target: { value: "accepted" } });
    expect(order()).toEqual(["two.jpg"]);
    expect(screen.getByText("Acceptată")).toBeInTheDocument();
  });
});
