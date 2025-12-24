import { useEffect, useState } from "react";
import { ProductsFromSessionStorage } from '../../../data/constants';

export const useProducts = () => {
  const [products, setProducts] = useState({});
  let productsFetched = sessionStorage.getItem(ProductsFromSessionStorage);

  useEffect(() => {
    if (productsFetched != null) {
      setProducts(JSON.parse(productsFetched));
    } else {
      const getInfo = async()=>{
        const {getData} = await import('../../../data/ProdFetch');
        getData().then((finalData:any) => {
          setProducts(JSON.parse(JSON.stringify(finalData)));
        });
      }
      getInfo();
   
    }
  }, []);

  return products;
};
