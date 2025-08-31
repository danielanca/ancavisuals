export interface ReviewsInterface {
  name: string;
  email: string;
  reviewActual: string;
  reviewProductID: string;
  starsNumber: string;
  mediaLink?: string;
}
export interface ReviewsProps {
  productIdentification: string;
  productData: ReviewsInterface;
  allReviews: any;
}
