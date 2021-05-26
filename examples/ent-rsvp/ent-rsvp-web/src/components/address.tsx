import { Fragment } from "react";

export default function Address({ activity }) {
  const address = activity.address;
  if (!address) {
    return null;
  }

  return (
    <Fragment>
      <div> {activity.location}</div>
      <div>
        {address.street} {address.apartment}
      </div>
      <div>
        {address.city}, {address.state} {address.zipCode}
      </div>
    </Fragment>
  );
}
