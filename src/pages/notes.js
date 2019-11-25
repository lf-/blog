import React, { useMemo, useState } from "react"
import { graphql } from "gatsby"
import styled from "@emotion/styled"
import { useFlexSearch } from "react-use-flexsearch"

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

const FilterBox = styled.div`
  margin-top: 1em;
  margin-bottom: 1em;
`
const values = obj => {
  let results = []
  for (let name in obj) {
    results.push(obj[name])
  }
  return results
}

const NotesPage = ({ data }) => {
  const [query, setQuery] = useState(null)
  const localSearchData = data.localSearchNotes
  const searchStore = useMemo(() => JSON.parse(localSearchData.store), [localSearchData])
  let results = useFlexSearch(query, localSearchData.index, searchStore)

  const makeTopicsBox = result => (<NotesTopicBox key={result.id} dangerouslySetInnerHTML={{ __html: result.html }}></NotesTopicBox>)
  console.log(results)

  return (
    <Layout>
      <SEO title="Notes" />
      <div css={Content}>
        <h1>Notes</h1>
        <FilterBox>
          <label>Filter </label>
          <input type="text" id="notesSearchBox" onChange={(ev) => setQuery(ev.target.value)} />
        </FilterBox>
        {
          // show all the notes when we don't have a filter
          (query ? results : values(searchStore)).map(makeTopicsBox)
        }
      </div>
    </Layout>
  );
}

export default NotesPage

export const query = graphql`
query Notes {
  localSearchNotes {
    index
    store
  }
}
`