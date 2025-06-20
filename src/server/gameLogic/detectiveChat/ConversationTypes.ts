export enum ConversationState {
  Introduction,
  DiscussingSuspects,
  GatheringEvidence,
  DiscussingFindings,
  MakingConclusions,
  // Add more states as needed
}
export type departmentType = "forensic" | "technical" | "assistant";
export interface ConversationStep {
  triggers: string[];
  response: string;
  nextState: ConversationState | ConversationState[];
  suggestedNextPrompts: string[];
}

export type ChatResponse = {
  response: string;
  suggestedNextPrompts: string[];
};
export interface accountInterface {
  accountID: string;
}
export interface messageAccount extends accountInterface {
  messageBlock: {
    departmentId: string;
    message: string;
  };
}

//data type that we will use between the client  <-  -> server
export interface streamType {
  clientId: string;
  departmentId: string;
  message?: string;
}
