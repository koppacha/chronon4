import DateFormatter from "./date-formatter";
import LikeButton from "@/components/LikeButton";
import {Grid} from "@mui/system";

type Props = {
    id: string,
    update: string,
    size: number
};

export function PostFooter({id, update, size}: Props) {

    return (
        <>
            <Grid container className="footer-container">
                <Grid size={6}><LikeButton articleId={id} /></Grid>
                <Grid size={6} textAlign="right">
                    <span>{Number(size).toLocaleString()} 文字 ー
                    最終更新：{update}</span>
                </Grid>
            </Grid>
        </>
    );
}
