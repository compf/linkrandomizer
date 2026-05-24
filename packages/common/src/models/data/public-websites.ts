import type { Website } from "../website_schemas.js";

export const publicWebsites: Website[] = [

    {
        name: "völkischer beobachter",
        version: 1,
        tags: ["nazi", "propaganda"],
        schema: [
            "https://anno.onb.ac.at/cgi-content/anno?aid=vob&datum=",
            { variable: "year", padding: null },
            { variable: "month", padding: 2 },
            { variable: "day", padding: 2 },
            "&seite=1&zoom=33"
        ],
        variables: [
            {
                name: "randomDate",
                minYear: 1938,
                maxYearExclusive: 1945,
            },
            {
                name: "randomFromRange",
                variableName: "page",
                min: 1,
                maxExclusive: 5
            }
        ],
        prompt: `
        Analysiere den folgenden Inhalt aus einer nationalsozialistischen Zeitung. Beschreibe die Propagandatechniken, die verwendet werden, um die Ideologie zu verbreiten. Welche Emotionen sollen beim Leser geweckt werden? Wie wird die Sprache eingesetzt, um bestimmte Gruppen zu diffamieren oder zu idealisieren? Welche historischen Ereignisse oder Feindbilder werden hervorgehoben? Bitte gib eine detaillierte Analyse der rhetorischen Mittel und der beabsichtigten Wirkung auf die Leserschaft.
        `,
        downloadType: "downloadFromURLInClipboard",





    },
    {
        name: "london gazette",
        schema: [
            "https://www.thegazette.co.uk/London/issue/",
            { variable: "page", padding: null },
            "/data.pdf"
        ],
        prompt:
        `
        Analyze the following content from the London Gazette. Describe the people and places mentioned and the historical context of the events being reported. What can we learn about the social, political, and economic conditions of the time from this content? Are there any notable trends or patterns in the types of announcements being made? Please provide a detailed analysis of the content and its significance within British history.
        `,
        tags: ["government", "legal", "history"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "page",
                maxExclusive: 50424,
                min: 1
            }
        ],
        downloadType: "downloadFromGeneratedURL",


    },
    //https://www.bundesgerichtshof.de/SiteGlobals/Forms/Suche/EntscheidungssucheBGH_Formular.html?submit=Datum+einschr%C3%A4nken&nsc=true&startDate=2025-11-10&endDate=2026-04-06&submit=Datum+einschr%C3%A4nken
    {
        name: "bundesgerichtshof decisions",
        schema: [
            "https://www.bundesgerichtshof.de/SiteGlobals/Forms/Suche/EntscheidungssucheBGH_Formular.html?submit=Datum+einschr%C3%A4nken&nsc=true&startDate=",
            { variable: "year1", padding: null },
            "-",
            { variable: "month1", padding: 2 },
            "-",
            { variable: "day1", padding: 2 },
            "&endDate=",
            { variable: "year2", padding: null },
            "-",
            { variable: "month2", padding: 2 },
            "-",
            { variable: "day2", padding: 2 },
            "&submit=Datum+einschr%C3%A4nken"
        ],
        downloadType: "downloadFromURLInClipboard",
        tags: ["government", "legal", "german"],
        variables: [
            {
                name: "randomDateRange",
                minYear: 2001,
                maxYearExclusive: 2026,
                maxNumberOfDaysToSecondDate: 30
            }
        ]
    },
    //https://www.courtlistener.com/?q=&type=r&order_by=entry_date_filed%20desc&available_only=on&filed_after=06%2F11%2F2024&filed_before=12%2F04%2F2024
    {
        name: "courtlistener",
        schema: [
            "https://www.courtlistener.com/?q=&type=r&order_by=entry_date_filed%20desc&available_only=on&filed_after=",
            { variable: "month1", padding: 2 },
            "%2F",
            { variable: "day1", padding: 2 },
            "%2F",
            { variable: "year1", padding: null },
            "&filed_before=",
            { variable: "month2", padding: 2 },
            "%2F",
            { variable: "day2", padding: 2 },
            "%2F",
            { variable: "year2", padding: null },
            "&page=",
            { variable: "page", padding: 2 },
        ],
        downloadType: "downloadFromURLInClipboard",
        tags: ["legal"],
        prompt:`
        Analyze the following legal documents recently filed in US courts. Identify the main legal issues being addressed and the parties involved. What are the potential implications of these cases for the legal landscape? Are there any emerging trends or patterns in the types of cases being filed? Please provide a detailed analysis of the legal arguments and the broader context of these filings.
        `,
        variables: [
            {
                name: "randomDateRange",
                minYear: 2005,
                maxYearExclusive: 2025,
                maxNumberOfDaysToSecondDate: 30
            },
            {
                name: "randomFromRange",
                min: 1,
                maxExclusive: 100,
                variableName: "page"
            }
        ]

    },
    {
        name: "niedersachsen rechtsprechung",
        schema: [
            "https://voris.wolterskluwer-online.de/search?query=&in_publication=&in_year=&in_edition=&voris_number=&issuer=&date=",
            { variable: "year1", padding: null },
            "-",
            { variable: "month1", padding: 2 },
            "-",
            { variable: "day1", padding: 2 },
            "&end_date_range=",
            { variable: "year2", padding: null },
            "-",
            { variable: "month2", padding: 2 },
            "-",
            { variable: "day2", padding: 2 },
            "&lawtaxonomy=&publicationtype=&pit=&da_id=&issuer_label=&content_tree_nodes="
        ],
        downloadType: "downloadFromURLInClipboard",
        tags: ["legal", "german"],
        variables: [
            {
                name: "randomDateRange",
                minYear: 2005,
                maxYearExclusive: 2025,
                maxNumberOfDaysToSecondDate: 30
            }
        ]

    },
    {
        name: "random wikipedia english",
        schema: [
            "https://en.wikipedia.org/wiki/Special:Random"
        ],
        downloadType: "downloadFromURLInClipboard",
        tags: ["wikipedia", "english"],
        variables: []
    },
    {
        name: "random wikipedia german",
        schema: [
            "https://de.wikipedia.org/wiki/Spezial:Zuf%C3%A4llige_Seite"
        ],
        downloadType: "downloadFromURLInClipboard",
        tags: ["wikipedia", "german"],
        variables: []
    },
    {
        name: "bundestag protocols",
        schema: [
            "https://dserver.bundestag.de/btp/",
            { variable: "wperiod", padding: 2 },
            "/",
            { variable: "wperiod", padding: 2 },
            { variable: "nummer", padding: 3 },
            ".pdf"
        ],
        prompt: `
        Analysiere den folgenden Auszug aus einem Protokoll des Deutschen Bundestags. Beschreibe die behandelten Themen und die Positionen der verschiedenen Parteien. Welche Argumentationstechniken werden verwendet, um die eigenen Standpunkte zu stärken oder die der Gegner zu schwächen? Gibt es rhetorische Mittel, die besonders häufig eingesetzt werden? Wie wird auf die Beiträge anderer Redner reagiert? Bitte gib eine detaillierte Analyse der politischen Debatte und der Kommunikationsstrategien.
        `,
        downloadType: "downloadFromGeneratedURL",
        tags: ["german", "parliamentary"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "wperiod",
                min: 1,
                maxExclusive: 20
            },
            {
                name: "randomFromRange",
                variableName: "nummer",
                min: 1,
                maxExclusive: 200
            }
        ]
    },

    {
        name: "niedersachsen plenar protocols",
        schema: [
            "https://www.landtag-niedersachsen.de/parlamentsdokumente/steno/",
            { variable: "wperiod", padding: 2 },
            "_wp/endber",
            { variable: "nummer", padding: 3 },
            ".pdf"
        ],
        prompt: `
        Analysiere den folgenden Auszug aus einem Protokoll des Niedersächsischen Landtags. Beschreibe die behandelten Themen und die Positionen der verschiedenen Parteien. Welche Argumentationstechniken werden verwendet, um die eigenen Standpunkte zu stärken oder die der Gegner zu schwächen? Gibt es rhetorische Mittel, die besonders häufig eingesetzt werden? Wie wird auf die Beiträge anderer Redner reagiert? Bitte gib eine detaillierte Analyse der politischen Debatte und der Kommunikationsstrategien.
        `,
        downloadType: "downloadFromGeneratedURL",
        tags: ["german", "parliamentary"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "wperiod",
                min: 1,
                maxExclusive: 20
            },
            {
                name: "randomFromRange",
                variableName: "nummer",
                min: 1,
                maxExclusive: 200
            }
        ]
    },



    {
        name: "bgbl",
        schema: [
            "https://media.offenegesetze.de/bgbl1/",
            { variable: "year", padding: null },
            "/bgbl1_",
            { variable: "year", padding: null },
            "_",
            { variable: "page", padding: null },
            ".pdf"
        ],
        prompt: `
            Analysiere den folgenden Auszug aus dem Bundesgesetzblatt. Beschreibe die behandelten Themen und die rechtlichen Implikationen. Welche gesellschaftlichen oder politischen Entwicklungen könnten zu diesem Gesetz geführt haben? Gibt es bestimmte Formulierungen oder Abschnitte, die besonders wichtig oder kontrovers sein könnten? Bitte gib eine detaillierte Analyse des Gesetzestextes und seiner möglichen Auswirkungen auf die Gesellschaft.
            `,
        downloadType: "downloadFromGeneratedURL",
        tags: ["legal", "german"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "year",
                min: 1949,
                maxExclusive: 2025
            },
            {
                name: "randomFromRange",
                variableName: "page",
                min: 1,
                maxExclusive: 60
            }
        ]
    },


    {
        name: "wikipedia usa year",
        schema: [
            "https://en.wikipedia.org/wiki/",
            { variable: "year", padding: null },
            "_in_the_United_States"

        ],
        downloadType: "downloadFromGeneratedURL",
        tags: ["wikipedia", "history", "usa"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "year",
                min: 1776,
                maxExclusive: 2000
            }
        ]
    },
    {
        name: "wikipedia german year",
        schema: [
            "https://de.wikipedia.org/wiki/",
            { variable: "year", padding: null },
            "_in_Deutschland"

        ],
        downloadType: "downloadFromGeneratedURL",
        tags: ["wikipedia", "history", "german"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "year",
                min: 1776,
                maxExclusive: 2000
            }
        ]
    },
    {
        name: "wikipedia uk year",
        schema: [
            "https://en.wikipedia.org/wiki/",
            { variable: "year", padding: null },
            "_in_the_United_Kingdom"

        ],
        downloadType: "downloadFromGeneratedURL",

        tags: ["wikipedia", "history"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "year",
                min: 1776,
                maxExclusive: 2000
            }
        ]
    },
    {
        name: "wikipedia year",
        schema: [
            "https://de.wikipedia.org/wiki/",
            { variable: "page", padding: null }

        ],
        downloadType: "downloadFromGeneratedURL",
        tags: ["wikipedia", "history", "german"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "page",
                min: 1,
                maxExclusive: 2000
            }
        ]
    },

    {
        name: "us house of representatives reports",
        schema: [
            "https://www.govinfo.gov/content/pkg/CRPT-",
            { variable: "congress", padding: null },
            "hrpt",
            { variable: "report", padding: null },
            "/pdf/CRPT-",
            { variable: "congress", padding: null },
            "hrpt",
            { variable: "report", padding: null },
            ".pdf"
        ],
        prompt:`
        Analyze the following report from the US House of Representatives. Identify the main topics being discussed and the key stakeholders involved. What are the potential implications of the findings or recommendations in this report for US policy and society? Are there any emerging trends or patterns in the issues being addressed by Congress? Please provide a detailed analysis of the report's content and its broader context within US politics.
        `,
        downloadType: "downloadFromGeneratedURL",
        tags: ["legal"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "congress",
                min: 109,
                maxExclusive: 119
            },
            {
                name: "randomFromRange",
                variableName: "report",
                min: 1,
                maxExclusive: 250
            }
        ]
    },
    {
        name: "rfc",
        schema: [

            "https://www.rfc-editor.org/rfc/rfc",
            { variable: "number", padding: null },
            ".html"
        ],
        downloadType: "downloadFromGeneratedURL",
        tags: ["technology", "internet"],
        variables: [
            {
                name: "randomFromRange",
                variableName: "number",
                min: 1,
                maxExclusive: 9000
            }
        ]

    },
]