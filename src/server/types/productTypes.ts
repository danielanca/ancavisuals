export interface ProductModel {
  ID: string;
  title: string;
  shortDescription: string;
  price: string;
  firstDescription: string;
  reviews: Record<string, string>;
  jsonContent: string;
  imageProduct: string[];
  ULbeneficii: string[];
}
