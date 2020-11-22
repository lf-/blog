const toml = require('toml')

module.exports = {
  siteMetadata: {
    title: `lfcode.ca`,
    siteUrl: `https://lfcode.ca`,
    subtitle: `i break computers`,
    description: `i write stuff about computers sometimes`,
    author: `@lf-`,
  },
  plugins: [
    `gatsby-plugin-dark-mode`,
    `gatsby-plugin-react-helmet`,
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `markdown-pages`,
        path: `${__dirname}/src/content`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `markdown-recipes`,
        path: `${__dirname}/src/recipes`,
      },
    },
    {
      resolve: `gatsby-source-filesystem`,
      options: {
        name: `images`,
        path: `${__dirname}/src/images`,
      },
    },
    `gatsby-transformer-sharp`,
    `gatsby-plugin-sharp`,
    `gatsby-plugin-emotion`,
    {
      resolve: `gatsby-transformer-remark`,
      options: {
        excerpt: true,
        excerpt_separator: '<!-- excerpt -->',
        engines: {
          'toml': toml.parse.bind(toml),
        },
        language: 'toml',
        delimiters: '+++',
        plugins: [
          `gatsby-remark-reading-time`,
          {
            resolve: `gatsby-remark-images`,
            options: {
              useWebp: true,
            }
          },
          {
            resolve: `gatsby-remark-prismjs`,
            options: {
              aliases: { sh: "bash", js: "javascript" },
              showLineNumbers: false,
            }
          },
        ],
      },
    },
    {
      resolve: `gatsby-plugin-local-search`,
      options: {
        name: `recipes`,
        engine: `flexsearch`,
        query: `
        {
          allMarkdownRemark(filter: {fileAbsolutePath: {regex: "/.*src\\/recipes\\/.*\\\\.md/"}}) {
            nodes {
              id
              html
              rawMarkdownBody
            }
          }
        }
        `,
        ref: `id`,
        store: [`id`, `html`],
        index: [`body`],
        normalizer: ({ data }) =>
          data.allMarkdownRemark.nodes.map(node => ({
            id: node.id,
            body: node.rawMarkdownBody,
            html: node.html,
          }))
      }
    },
    {
      resolve: `gatsby-plugin-feed`,
      options: {
        query: `
          {
            site {
              siteMetadata {
                title
                description
                siteUrl
                site_url: siteUrl
              }
            }
          }
        `,
        feeds: [
          {
            serialize: ({ query: { site, allMarkdownRemark } }) => {
              return allMarkdownRemark.edges.map(edge => {
                return Object.assign({}, edge.node.frontmatter, {
                  description: edge.node.excerpt,
                  date: edge.node.frontmatter.date,
                  url: site.siteMetadata.siteUrl + (edge.node.frontmatter.path || `/blog/${node.fields.slug.replace(/\//g, '')}`),
                  guid: site.siteMetadata.siteUrl + edge.node.fields.slug,
                  custom_elements: [{'content:encoded': edge.node.html}],
                })
              })
            },
            output: '/rss.xml',
            title: 'lfcode.ca',
            query: `
            {
              allMarkdownRemark(filter: {
                    fileAbsolutePath: {regex: "/.*src\\/content\\/.*\\\\.md/"},
                    frontmatter: {
                      isPage: {ne: true},
                      draft: {ne: true}
                    }
                  }, sort: {order: DESC, fields: frontmatter___date}) {
                edges {
                  node {
                    frontmatter {
                      date
                      title
                      path
                    }
                    fields {
                      slug
                    }
                    html
                    excerpt
                  }
                }
              }
            }
            `,
          }
        ]
      }
    },
    {
      resolve: `gatsby-plugin-manifest`,
      options: {
        name: `gatsby-starter-default`,
        short_name: `starter`,
        start_url: `/`,
        background_color: `#663399`,
        theme_color: `#663399`,
        display: `minimal-ui`,
        icon: `src/images/gatsby-icon.png`, // This path is relative to the root of the site.
      },
    },
    // this (optional) plugin enables Progressive Web App + Offline functionality
    // To learn more, visit: https://gatsby.dev/offline
    // 'gatsby-plugin-offline',
  ],
}
