import { Link } from "react-router-dom";

import SideBarButton from "./SideBarButton.jsx";
import Logo from "../../components/Logo.jsx";

import {
    House,
    CalendarDays,
    PanelLeft
} from "lucide-react";

const navigationItems = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: House,
        to: '/',
    },

    {
        id: 'programs',
        label: 'Programs',
        icon: CalendarDays,
        to: '/programs',
    },

]

const Sidebar = ({ isOpen, onToggle }) => {
    const mobileStyles = isOpen
        ? "translate-x-0"
        : "-translate-x-full";


    return (
        <div className={`
            fixed top-0 bottom-0 w-[70dvw] md:w-[40dvw] z-99
            flex flex-col gap-xl items-center
            p-md border-r border-text-primary/10
            bg-bg-surface
            ${mobileStyles} 
            lg:relative lg:w-auto lg:translate-x-0
        `}>
            <button
                className="lg:hidden flex items-center justify-center absolute top-sm right-0 translate-x-full bg-primary w-3xl h-3xl rounded-r-3xl cursor-pointer"
                onClick={onToggle}
            >
                <PanelLeft strokeWidth={2.5} className="w-lg h-lg" />
            </button>

            <div className={`flex items-center ${isOpen ? 'justify-between' : 'justify-center'} w-full`}>
                {isOpen && (
                    <Link
                        to="/"
                        className="flex items-center gap-sm font-display text-body-sm font-medium"
                        aria-label="Auctus home"
                    >
                        <Logo />
                    </Link>
                )}

                <button
                    className="text-text-primary/75 hover:text-text-primary cursor-pointer hidden lg:block w-lg h-lg"
                    onClick={onToggle}
                >
                    <PanelLeft strokeWidth={2.5} className="w-lg h-lg" />
                </button>
            </div>

            <div className="flex flex-col gap-sm w-full border-t pt-lg border-text-primary/25">
                {navigationItems.map(item => {
                    return (
                        <SideBarButton
                            key={item.id}
                            icon={item.icon}
                            label={item.label}
                            to={item.to}
                            isOpen={isOpen}
                        />
                    )
                })}
            </div>

        </div>

    )
}

export default Sidebar;
