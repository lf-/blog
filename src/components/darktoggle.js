import React from 'react'
import { ThemeToggler } from 'gatsby-plugin-dark-mode'
import styled from '@emotion/styled'

const PaddedLabel = styled.label`
    * {
        margin-right: 3px;
    }
`

export class DarkToggle extends React.Component {
    render() {
        return (
            <ThemeToggler>
                {({ theme, toggleTheme }) => (
                    <PaddedLabel>
                        <input type="checkbox"
                            onChange={e => toggleTheme(e.target.checked ? 'dark' : 'light')}
                            checked={theme === 'dark'}
                        />
                        Dark
                    </PaddedLabel>
                )}
            </ThemeToggler>
        )
    }
}
