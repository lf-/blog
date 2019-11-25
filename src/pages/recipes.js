import React, { useMemo, useState } from "react"
import { graphql } from "gatsby"
import styled from "@emotion/styled"
import { useFlexSearch } from "react-use-flexsearch"

import Layout from "../components/layout"
import { Content, MarkdownContentCSS } from "../components/common-styles"
import SEO from "../components/seo"

const RecipesTopicBox = styled.div`
  ${MarkdownContentCSS};
  padding: 10px;

  background: var(--boxColor);
  border-radius: 15px;
  
  margin-left: -10px;
  margin-right: -10px;

  margin-bottom: 2.5em;
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

const RecipesPage = ({ data }) => {
  const [query, setQuery] = useState(null)
  const localSearchData = data.localSearchRecipes
  const searchStore = useMemo(() => JSON.parse(localSearchData.store), [localSearchData])
  let results = useFlexSearch(query, localSearchData.index, searchStore)

  const makeTopicsBox = result => (<RecipesTopicBox key={result.id} dangerouslySetInnerHTML={{ __html: result.html }}></RecipesTopicBox>)
  console.log(results)

  return (
    <Layout>
      <SEO title="Recipes" />
      <div css={Content}>
        <h1>Recipes</h1>
        <FilterBox>
          <label>Filter </label>
          <input type="text" id="recipesSearchBox" onChange={(ev) => setQuery(ev.target.value)} />
        </FilterBox>
        {
          // show all the recipes when we don't have a filter
          (query ? results : values(searchStore)).map(makeTopicsBox)
        }
      </div>
    </Layout>
  );
}

export default RecipesPage

export const query = graphql`
query Recipes {
  localSearchRecipes {
    index
    store
  }
}
`
