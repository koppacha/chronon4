import DateFormatter from "./date-formatter";
import LikeButton from "@/components/LikeButton";
import {Grid} from "@mui/system";
import ReadButton from "@/components/ReadButton";

type Props = {
    id: string,
    update: string,
    size: number,
    canInteract?: boolean,
    yearColor?: string,
};

export function PostFooter({id, update, size, canInteract = true, yearColor}: Props) {

    return (
        <>
            <Grid container className="footer-container">
                <Grid size={4}>{canInteract ? <><LikeButton articleId={id} yearColor={yearColor} /><ReadButton articleId={id} yearColor={yearColor} /></> : null}</Grid>
                <Grid size={8} textAlign="right">
                    <span>{Number(size).toLocaleString()} 文字 ー
                    最終更新：{update}</span>
                </Grid>
            </Grid>
        </>
    );
}
