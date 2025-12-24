import { useEffect, useState } from "react";
import { ProductsFromSessionStorage } from "../../data/constants";
import { DocumentData } from "firebase/firestore";
import { getData } from "../../data/ProdFetch";

export const useProducts = () => {
  const [products, setProducts] = useState<DocumentData | null>({});
  const productsFetched = sessionStorage.getItem(ProductsFromSessionStorage);

  useEffect(() => {
    if (productsFetched) {
      setProducts(JSON.parse(productsFetched));
    } else {
      getData()
        .then((finalData) => {
          setProducts(finalData);
        })
        .catch((error) => console.log("There is an error on useProducts hook", error));
    }
  }, []);

  return products;
};
