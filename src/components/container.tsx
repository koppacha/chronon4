import React from "react";
import {Grid} from "@mui/system";

type Props = {
  children?: React.ReactNode;
};

const Container = ({ children }: Props) => {
  return <Grid container className="container">{children}</Grid>;
};

export default Container;
