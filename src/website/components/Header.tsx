import React from 'react'
import { Link } from 'react-router-dom'
import { GitHub } from 'react-feather'
import { Logo } from './Logo'
import { useScroll } from '../hooks/useScroll'
import { Button } from '../../components/Button'

export function Header() {
  const isScrolled = useScroll()

  return (
    <div
      className={`flex flex-col items-center w-full text-neutral-600 font-semibold bg-neutral-100 ${
        isScrolled ? 'sticky top-0 shadow-md transition-shadow z-50' : ''
      }`}
    >
      <div className="flex items-center w-full max-w-screen-xl p-4">
        <Link to="/">
          <Logo />
        </Link>
        <div className="flex ml-auto text-sm gap-1 md:flex">
          <Link
            to="/#features"
            className="p-2 hover:bg-neutral-200 bg-opacity-60 rounded"
          >
            Features
          </Link>
          <Link
            to="/changelog"
            className="p-2 hover:bg-neutral-200 bg-opacity-60 rounded"
          >
            Changelog
          </Link>
          <a href="https://github.com/thejae/chirp-for-chromium">
            <Button className="hidden md:flex w-fit ml-1" Icon={GitHub}>
              View on GitHub
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}
