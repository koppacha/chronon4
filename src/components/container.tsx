import React from "react";
import {Grid} from "@mui/system";

type Props = {
    children?: React.ReactNode,
    maxWidth?: string
};

const Container = ({children, maxWidth}: Props) => {
    return <Grid container className="container">{children}</Grid>;
};

export default Container;
