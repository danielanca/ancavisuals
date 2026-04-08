export interface ReviewType {
  starsNumber: string;
  reviewActual: string;
  name: string;
  email: string;
  date?: string;
  reviewProductID: string;
  mediaLink?: string;
}

export interface ReviewToPostType {
  starsNumber: string;
  reviewActual: string;
  name: string;
  email: string;
  date?: string;
  mediaLink?: string;
}
