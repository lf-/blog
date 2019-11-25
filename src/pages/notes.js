import React from "react"
import { graphql } from "gatsby"
import styled from "@emotion/styled"

import Layout from "../components/layout"
import { Content } from "../components/common-styles"
import SEO from "../components/seo"

const NotesTopicBox = styled.div`
  padding: 10px;

  background: var(--boxColor);
  border-radius: 15px;
  
  margin-left: -10px;
  margin-right: -10px;
`
const NotesPage = ({ data }) => {
  return (
    <Layout>
      <SEO title="Notes" />
      <div css={Content}>
        <h1>Notes</h1>
        {
          data.allMarkdownRemark.nodes.map(node => {
            return <NotesTopicBox key={node.id} dangerouslySetInnerHTML={{ __html: node.html }}></NotesTopicBox>
          })
        }
      </div>
    </Layout>
  );
}

export default NotesPage

export const query = graphql`
query Notes {
  allMarkdownRemark(filter: {fileAbsolutePath: {regex: "/.*src\\/notes\\/.*\\\\.md/"}}) {
    nodes {
      id
      html
      rawMarkdownBody
    }
  }
}
`