// ConversationMap.ts

import { ConversationState, ConversationStep } from "./ConversationTypes";

// export const conversationMap: Map<ConversationState, ConversationStep[]> = new Map([
//     [ConversationState.Introduction, [{
//       triggers: ['start', 'hello'],
//       response: "There's been a new case. Are you ready to discuss the suspects?",
//       nextState: ConversationState.DiscussingSuspects,
//     }]],
//     [ConversationState.DiscussingSuspects, [{
//       triggers: ['suspect'],
//       response: "Yes, let's focus on the suspect. What evidence do we have?",
//       nextState: ConversationState.GatheringEvidence,
//     }]],
//     [ConversationState.GatheringEvidence, [{
//       triggers: ['evidence'],
//       response: "Good. Let's analyze this evidence.",
//       nextState: ConversationState.DiscussingFindings,
//     }]],
//     [ConversationState.DiscussingFindings, [{
//       triggers: ['analyze', 'findings'],
//       response: "Based on our findings, what's your conclusion?",
//       nextState: ConversationState.MakingConclusions,
//     }]],
//     [ConversationState.MakingConclusions, [{
//       triggers: ['conclusion'],
//       response: "Our investigation has concluded. Great work!",
//       nextState: ConversationState.Introduction, // Loop back or conclude
//     }]],
//     // Add more conversation steps as needed
// ]);

export const conversationMapSecond: Map<ConversationState, ConversationStep[]> = new Map([
  [
    ConversationState.Introduction,
    [
      {
        triggers: ["Salutare", "Buna ziua!"],
        response: "Buna! Avem un nou caz, ai dori sa vorbim despre el?",
        suggestedNextPrompts: ["Stiu deja cazul, am primit dosarul."],
        nextState: ConversationState.DiscussingSuspects,
      },
    ],
  ],
  [
    ConversationState.DiscussingSuspects,
    [
      {
        triggers: ["Stiu deja cazul, am primit dosarul."],
        response: "Am inteles! Este vorba de: Mihai, Adrian si Cristi. Despre care doresti sa vorbim?",
        suggestedNextPrompts: ["Sa vorbim despre Mihai.", "Sa vorbim despre Adrian", "Sa vorbim despre Cristian"],
        nextState: ConversationState.GatheringEvidence,
      },
    ],
  ],
  [
    ConversationState.GatheringEvidence,
    [
      {
        triggers: ["Sa vorbim despre Mihai."],
        response:
          "Ce avem despre acest individ este ca a mai comis diferite fapte in trecut. Ar fi bine sa dai un ochi peste prostiile pe care el le-a mai facut",
        suggestedNextPrompts: ["Ce anume a facut?", "Mai este cineva implicat?"],
        nextState: ConversationState.DiscussingFindings,
      },
    ],
  ],
  [
    ConversationState.DiscussingFindings,
    [
      {
        triggers: ["Show me the evidence.", "What evidence is there?"],
        response:
          "We found a few pieces of evidence. [Details about the evidence]. Based on this, what's your conclusion?",
        suggestedNextPrompts: ["I think the suspect is guilty.", "I think the suspect is innocent."],
        nextState: ConversationState.MakingConclusions,
      },
    ],
  ],
  [
    ConversationState.MakingConclusions,
    [
      {
        triggers: ["I think the suspect is guilty.", "I think the suspect is innocent."],
        response:
          "Your conclusion has been noted. Our investigation will take your analysis into account. Would you like to investigate another case?",
        suggestedNextPrompts: ["Yes, start a new investigation.", "No, Im done"],
        nextState: ConversationState.Introduction,
      },
    ],
  ],
]);
