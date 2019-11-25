import { Link } from "gatsby"
import styled from "@emotion/styled"
import PropTypes from "prop-types"
import React from "react"
import { DarkToggle } from "./darktoggle.js"

const Content = styled.div`
  max-width: 860px;
  padding: 1rem 1rem;
  font-size: 1.2rem;
`

const NavItem = styled.li`
  color: var(--navColor);
  margin-left: 7.5px;
  margin-right: 7.5px;
  text-decoration: none;
  display: inline-block;
  position: relative;

  ::after {
    content: "";
    position: absolute;
    width: 100%;
    transform: scaleX(0);
    height: 2px;
    bottom: 0;
    left: 0;
    background-color: var(--navColor);
    transform-origin: bottom right;
    transition: transform 0.4s cubic-bezier(0.86, 0, 0.07, 1);
  }

  :hover::after {
    transform: scaleX(1);
    transform-origin: bottom left;
  }
`

const NavLink = styled.a`
  color: var(--navColor);
  text-decoration: none;
`

const SiteHeader = styled.nav`
  background: transparent;
  display: flex;
  align-content: center;
  justify-content: center;
`

const Header = ({ siteTitle }) => (
  <SiteHeader>
    <Content>
      <ul>
        <NavItem><NavLink as={Link} to="/">{siteTitle}</NavLink></NavItem>
        <NavItem>
          <NavLink as={Link} to="/recipes">Recipes</NavLink>
        </NavItem>
        <NavItem>
          <NavLink as={Link} to="/about">About</NavLink>
        </NavItem>
        <NavItem><NavLink href="https://github.com/lf-">
          GitHub
        </NavLink></NavItem>
        <NavItem><DarkToggle /></NavItem>
      </ul>
    </Content>
  </SiteHeader>
)

Header.propTypes = {
  siteTitle: PropTypes.string,
}

Header.defaultProps = {
  siteTitle: ``,
}

export default Header
