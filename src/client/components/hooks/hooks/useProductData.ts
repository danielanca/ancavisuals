
import { useState, useEffect } from 'react';

const useProductData = () => {
  const [ssProducts, setSSproducts] = useState<any>();

  useEffect(() => {
    const loadProducts = async() => {
      if (ssProducts == null) {
        const {getData} = await import ("./../../../data/productList");
       // Replace getData() with your actual data fetching function
       getData().then((finalData:any) => {
         sessionStorage.setItem("productsFetched", JSON.stringify(finalData));
       });
     }
    }
    loadProducts();
  
  }, [ssProducts]);

  return [ssProducts, setSSproducts];
};

export default useProductData;
