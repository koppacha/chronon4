import React, {Key} from "react";
import { Box } from "@mui/material";
import {baseUrl} from "@/lib/const";
import {Author} from "@/interfaces/author";
import {PostHeader} from "@/components/post-header";
import PostBody from "@/components/post-body";
import markdownToHtml from "@/lib/markdownToHtml";
import {id2slug} from "@/lib/chronon4";

const SideMenu: React.FC = async () => {

    const res = await fetch(`${baseUrl}/api/recent?n=365&f=tdg`)
    const posts = await res.json()

    return (
        <Box
            sx={{
                width: "100%",
                padding: "4px",
            }}
        >
            <h3>直近１年の記事</h3>
            <ul>
                {
                    posts.map(async function(post: { id: Key; title: string; date: string; tags: any }) {

                        // 年、月、日、記事番号
                        return (
                            <a href={`/post/${post.id}`}>
                                <li key={post.id} className="post-list">
                                    <span>#{Number(post.id)}</span>
                                    『{post.title}』
                                    <span>({new Date(post.date).toLocaleDateString('ja-JP')}）</span><br/>
                                    <span style={{textAlign:"right"}} className="tag-block">{post.tags[0]}</span>
                                </li>
                            </a>
                        )
                    })
                }
            </ul>
        </Box>
    );
};

export default SideMenu;