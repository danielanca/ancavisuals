import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import PhotoConsensusPanel from "src/client/components/Media/PhotoConsensusPanel";
import { type PhotoVote, type PhotoReviewerId } from "src/shared/media/proposalConsensus";

const photoVotes = (fileName: string, reviewers: PhotoReviewerId[], destinations: PhotoVote["destinations"] = ["instagram", "media_assets"]): PhotoVote[] =>
  reviewers.map(reviewer => ({ id: `${fileName}-${reviewer}`, fileName, albumSlug: "album", photoUrl: `https://cdn.test/${fileName}`,
    reviewerId: reviewer, proposedBy: reviewer, destinations }));
const proposals = [
  ...photoVotes("unanimous.jpg", ["daniel", "estera", "salomeea"]),
  ...photoVotes("two.jpg", ["daniel", "estera"], ["instagram"]),
  ...photoVotes("one.jpg", ["salomeea"], ["media_assets"]),
];

describe("PhotoConsensusPanel", () => {
  test("default shows unanimous photos; filters expose two-person and individual choices", () => {
    render(<PhotoConsensusPanel proposals={proposals} />);
    expect(screen.getByAltText("unanimous.jpg")).toBeInTheDocument();
    expect(screen.queryByAltText("two.jpg")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cel puțin 2 (2)" }));
    expect(screen.getByAltText("two.jpg")).toBeInTheDocument();
    expect(screen.getByAltText("unanimous.jpg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "O singură persoană (1)" }));
    expect(screen.getByAltText("one.jpg")).toBeInTheDocument();
    expect(screen.getByText("Salomeea", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Fără vot: Daniel, Estera")).toBeInTheDocument();
  });

  test("the Media Assets entry opens with votes for that destination", () => {
    render(<PhotoConsensusPanel proposals={proposals} initialDestination="media_assets" />);
    expect(screen.getByRole("combobox", { name: "Destinația voturilor" })).toHaveValue("media_assets");
    fireEvent.click(screen.getByRole("button", { name: "Toate votate (2)" }));
    expect(screen.queryByAltText("two.jpg")).not.toBeInTheDocument();
    expect(screen.getByAltText("one.jpg")).toBeInTheDocument();
  });

  test("refreshing votes retains the chosen consensus filter", () => {
    const { rerender } = render(<PhotoConsensusPanel proposals={proposals} />);
    fireEvent.click(screen.getByRole("button", { name: "O singură persoană (1)" }));
    rerender(<PhotoConsensusPanel proposals={proposals} loading />);
    rerender(<PhotoConsensusPanel proposals={proposals} loading={false} />);
    expect(screen.getByAltText("one.jpg")).toBeInTheDocument();
    expect(screen.queryByAltText("unanimous.jpg")).not.toBeInTheDocument();
  });

  test("destination and reviewer filters reflect their independent selections", () => {
    render(<PhotoConsensusPanel proposals={proposals} />);
    fireEvent.click(screen.getByRole("button", { name: "Toate votate (3)" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Destinația voturilor" }), { target: { value: "media_assets" } });
    expect(screen.queryByAltText("two.jpg")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Persoana care a votat" }), { target: { value: "daniel" } });
    expect(screen.getByAltText("unanimous.jpg")).toBeInTheDocument();
    expect(screen.queryByAltText("one.jpg")).not.toBeInTheDocument();
  });
});
