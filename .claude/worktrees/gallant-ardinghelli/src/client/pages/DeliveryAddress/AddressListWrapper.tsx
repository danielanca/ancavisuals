import { useParams } from 'react-router-dom';
import DeliveryAddressModal from './AddressList'; // rename your current component

export default function AddressListWrapper() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  console.log('Wrapper slug:', slug); // for debugging

  if (!slug) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#dc2626', fontSize: '1.2rem' }}>
        Error: No album slug found in URL.<br />
        Example: /my-wedding-2025/delivery-address
      </div>
    );
  }

  return <DeliveryAddressModal slug={slug} isOpen={false} onClose={()=>{}} />;
}