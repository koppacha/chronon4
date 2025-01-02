import React from "react";
import { Box } from "@mui/material";

const SideMenu: React.FC = () => {
    return (
        <Box
            sx={{
                width: 320,
                height: "100vh",
                backgroundColor: "#f4f4f4",
                borderRight: "2px solid #000",
                padding: "16px",
            }}
        >
            <h2>Menu</h2>
            <ul>
                <li>Item 1</li>
                <li>Item 2</li>
                <li>Item 3</li>
            </ul>
        </Box>
    );
};

export default SideMenu;