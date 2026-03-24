import { OrderLayout } from '@/components/order/order-layout';

export default function OrderRootLayout({ children }: { children: React.ReactNode }) {
  return <OrderLayout>{children}</OrderLayout>;
}
