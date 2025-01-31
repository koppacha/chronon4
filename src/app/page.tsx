import Container from "@/components/container";
import { Intro } from "@/components/intro";
import {PostHeader} from "@/components/post-header";
import PostBody from "@/components/post-body";
import markdownToHtml from "@/lib/markdownToHtml";
import SideMenu from "@/components/side-menu";
import {Box, Grid} from "@mui/material";
import {baseUrl} from "@/lib/const";
import {id2slug} from "@/lib/chronon4";

export default function Index() {

    async function RenderRecentPosts() {
        const res = await fetch(`${baseUrl}/api/recent`)
        if(!res.ok){
            return <div>Failed to load</div>
        }
        const posts = await res.json()
        return (
            <div>
                {posts?.map(async (post:any) => (
                    <article key={post.id} className="article">
                        <PostHeader
                            id={post.id}
                            title={post.title}
                            coverImage={post.coverImage}
                            date={post.date}
                            author={post.author}
                            tags={post.tags}
                            categories={post.category}
                        />
                        <PostBody category={post.category} content={await markdownToHtml(post.content || "")} date={post.date}/>
                    </article>
                ))}
            </div>
        );
    }

    return (
        <>
            <Container maxWidth="xl">
                <Grid container>
                    <Grid item xs={12}>
                        <Intro/>
                    </Grid>
                    <Grid item xs={12} md={9} sx={{ order: { xs: 2, md: 1 } }}>
                        <RenderRecentPosts/>
                    </Grid>
                    <Grid item xs={12} md={3} sx={{ order: { xs: 3, md: 2 } }}>
                        <SideMenu />
                    </Grid>
                </Grid>
            </Container>
        </>
    );
}
