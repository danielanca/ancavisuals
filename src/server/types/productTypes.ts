export interface ProductModel {
  ID: string;
  title: string;
  shortDescription: string;
  price: string;
  firstDescription: string;
  reviews: {};
  // reviews: { [key:string]: };
  jsonContent: string;
  imageProduct: [];
  ULbeneficii: [];
}
