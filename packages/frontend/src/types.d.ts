import { ElectronService } from "@linkrandomizer/common";

declare global{
    interface Window {
       api:ElectronService
    }
}