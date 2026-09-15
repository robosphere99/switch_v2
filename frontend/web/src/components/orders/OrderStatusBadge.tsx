import { Badge } from "../ui/Badge";

export interface OrderStatusBadgeProps {
  status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  switch (status) {
    case "paid":
      return <Badge variant="primary" dot>Paid</Badge>;
    case "shipped":
      return <Badge variant="info" dot>Shipped</Badge>;
    case "delivered":
      return <Badge variant="success" dot>Delivered</Badge>;
    case "cancelled":
      return <Badge variant="danger" dot>Cancelled</Badge>;
    case "pending":
    default:
      return <Badge variant="warning" dot>Pending</Badge>;
  }
}
